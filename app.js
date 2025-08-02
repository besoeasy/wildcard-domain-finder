#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const dns = require("dns").promises;
const readline = require("readline");

// Configuration
const CONFIG = {
  ALPHABET: "abcdefghijklmnopqrstuvwxyz0123456789", // Characters to use for wildcards
  CONCURRENT_CHECKS: 10, // Number of concurrent domain checks
  TIMEOUT: 5000, // DNS timeout in milliseconds
  OUTPUT_FILE: "available_domains.txt",
  PROGRESS_UPDATE_INTERVAL: 50 // Update progress every N checks
};

class DomainFinder {
  constructor(options = {}) {
    this.concurrentChecks = options.concurrentChecks || CONFIG.CONCURRENT_CHECKS;
    this.timeout = options.timeout || CONFIG.TIMEOUT;
    this.outputFile = options.outputFile || CONFIG.OUTPUT_FILE;
    this.stats = {
      total: 0,
      checked: 0,
      available: 0,
      errors: 0,
      startTime: null
    };
    this.recentlyFound = []; // Store last 3 found domains
    this.currentlyChecking = ''; // Current domain being checked
  }

  // Function to check if a domain is available (unreachable/unregistered)
  async isDomainAvailable(domain) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      await dns.resolve(domain);
      clearTimeout(timeoutId);
      return false; // Domain is registered/reachable
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return true; // Domain appears to be available
      }
      // Other errors (timeout, network issues, etc.)
      this.stats.errors++;
      return false; // Assume unavailable on error
    }
  }

  // Generate all possible domain combinations
  generateDomains(baseDomain, randomize = true) {
    if (!baseDomain.includes('*')) {
      return [baseDomain]; // No wildcards to replace
    }

    const chars = CONFIG.ALPHABET.split("");
    if (randomize) {
      chars.sort(() => Math.random() - 0.5);
    }
    
    const domains = [];

    const generateWithWildcard = (domain, index) => {
      if (index === domain.length) {
        domains.push(domain);
        return;
      }
      
      if (domain[index] === "*") {
        for (const char of chars) {
          generateWithWildcard(
            domain.slice(0, index) + char + domain.slice(index + 1), 
            index + 1
          );
        }
      } else {
        generateWithWildcard(domain, index + 1);
      }
    };

    generateWithWildcard(baseDomain, 0);
    return domains;
  }

  // Process domains in batches with concurrency control
  async processDomainBatch(domains, writer) {
    const results = [];
    
    for (let i = 0; i < domains.length; i += this.concurrentChecks) {
      const batch = domains.slice(i, i + this.concurrentChecks);
      const batchPromises = batch.map(async (domain) => {
        this.currentlyChecking = domain;
        const available = await this.isDomainAvailable(domain);
        this.stats.checked++;
        
        if (available) {
          this.stats.available++;
          writer.write(`${domain}\n`);
          
          // Add to recently found domains (keep only last 3)
          this.recentlyFound.unshift(domain);
          if (this.recentlyFound.length > 3) {
            this.recentlyFound.pop();
          }
        }
        
        return { domain, available };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Update progress more frequently for better UX
      if (this.stats.checked % 5 === 0 || 
          this.stats.checked === this.stats.total) {
        this.displayProgress();
      }
    }

    return results;
  }

  // Display progress and statistics
  displayProgress() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = this.stats.checked / elapsed;
    const eta = (this.stats.total - this.stats.checked) / rate;
    const percentage = (this.stats.checked / this.stats.total) * 100;
    
    // Create progress bar
    const barWidth = 40;
    const filledWidth = Math.round((percentage / 100) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    const progressBar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);
    
    console.clear();
    console.log('🔍 Domain Finder - Live Progress');
    console.log('='.repeat(70));
    
    // Progress bar with percentage
    console.log(`Progress: [${progressBar}] ${percentage.toFixed(1)}%`);
    console.log(`Status: ${this.stats.checked}/${this.stats.total} domains checked`);
    console.log('');
    
    // Statistics
    console.log('📊 Statistics:');
    console.log(`   ✅ Available: ${this.stats.available}`);
    console.log(`   ❌ Errors: ${this.stats.errors}`);
    console.log(`   ⏱️  Elapsed: ${elapsed.toFixed(1)}s`);
    console.log(`   🚀 Rate: ${rate.toFixed(1)} domains/sec`);
    if (eta && eta < Infinity && eta > 0) {
      console.log(`   ⏰ ETA: ${eta.toFixed(1)}s`);
    }
    console.log('');
    
    // Recently found domains
    if (this.recentlyFound.length > 0) {
      console.log('🎯 Recently Found Available Domains:');
      this.recentlyFound.forEach((domain, index) => {
        const icon = index === 0 ? '🆕' : index === 1 ? '📌' : '📋';
        console.log(`   ${icon} ${domain}`);
      });
    } else {
      console.log('🔍 No available domains found yet...');
    }
    
    console.log('');
    console.log(`🔄 Currently checking: ${this.currentlyChecking || 'Initializing...'}`);
    console.log('='.repeat(70));
    console.log('💡 Press Ctrl+C to stop the search');
  }

  // Main execution function
  async findAvailableDomains(baseDomain) {
    console.log(`🚀 Starting domain search for pattern: ${baseDomain}`);
    
    // Generate all domain combinations
    console.log('📝 Generating domain combinations...');
    const domains = this.generateDomains(baseDomain);
    this.stats.total = domains.length;
    this.stats.startTime = Date.now();
    
    console.log(`📊 Generated ${domains.length} domain combinations`);
    console.log(`⚙️  Using ${this.concurrentChecks} concurrent checks\n`);

    // Create output file
    const filePath = path.join(__dirname, this.outputFile);
    const writer = fs.createWriteStream(filePath, { flags: "w" }); // Overwrite mode
    
    try {
      // Process domains
      await this.processDomainBatch(domains, writer);
      
      // Final summary
      const totalTime = (Date.now() - this.stats.startTime) / 1000;
      console.clear();
      console.log('🎉 Domain Search Completed Successfully!');
      console.log('='.repeat(60));
      console.log(`📊 Total domains checked: ${this.stats.total}`);
      console.log(`✅ Available domains found: ${this.stats.available}`);
      console.log(`❌ Errors encountered: ${this.stats.errors}`);
      console.log(`⏱️  Total time: ${totalTime.toFixed(1)}s`);
      console.log(`🚀 Average rate: ${(this.stats.total / totalTime).toFixed(1)} domains/sec`);
      console.log(`📁 Results saved to: ${filePath}`);
      
      // Show all found domains if not too many
      if (this.recentlyFound.length > 0) {
        console.log('');
        console.log('🎯 Available Domains Found:');
        // Show all found domains from the file
        if (this.stats.available <= 10) {
          // Read and display all found domains if 10 or fewer
          try {
            const foundDomains = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(d => d);
            foundDomains.forEach((domain, index) => {
              console.log(`   ${index + 1}. ${domain}`);
            });
          } catch (error) {
            // Fallback to recent domains
            this.recentlyFound.reverse().forEach((domain, index) => {
              console.log(`   ${index + 1}. ${domain}`);
            });
          }
        } else {
          console.log(`   💡 ${this.stats.available} domains found - check ${this.outputFile} for full list`);
          console.log('   📋 Last 3 found:');
          this.recentlyFound.reverse().forEach((domain, index) => {
            console.log(`      ${index + 1}. ${domain}`);
          });
        }
      } else {
        console.log('');
        console.log('😔 No available domains found with this pattern.');
        console.log('💡 Try a different pattern or check a different TLD (.org, .net, etc.)');
      }
      
      console.log('='.repeat(60));
      
    } finally {
      writer.end();
    }
  }
}

// Command line argument parsing
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    domain: null,
    concurrentChecks: CONFIG.CONCURRENT_CHECKS,
    timeout: CONFIG.TIMEOUT,
    outputFile: CONFIG.OUTPUT_FILE,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-d':
      case '--domain':
        options.domain = args[++i];
        break;
      case '-c':
      case '--concurrent':
        options.concurrentChecks = parseInt(args[++i]) || CONFIG.CONCURRENT_CHECKS;
        break;
      case '-t':
      case '--timeout':
        options.timeout = parseInt(args[++i]) || CONFIG.TIMEOUT;
        break;
      case '-o':
      case '--output':
        options.outputFile = args[++i];
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        if (!options.domain && !arg.startsWith('-')) {
          options.domain = arg;
        }
        break;
    }
  }

  return options;
}

// Show help information
function showHelp() {
  console.log(`
🔍 Domain Finder - Find available domain names

Usage: node app.js [options] <domain-pattern>

Arguments:
  domain-pattern    Domain pattern with wildcards (*) to search
                   Example: test*.com, *domain.org, sub*.example.*

Options:
  -d, --domain      Domain pattern to search (alternative to positional arg)
  -c, --concurrent  Number of concurrent DNS checks (default: ${CONFIG.CONCURRENT_CHECKS})
  -t, --timeout     DNS timeout in milliseconds (default: ${CONFIG.TIMEOUT})
  -o, --output      Output file name (default: ${CONFIG.OUTPUT_FILE})
  -h, --help        Show this help message

Examples:
  node app.js "test*.com"
  node app.js --domain "my*site.org" --concurrent 20
  node app.js -d "*domain.net" -c 5 -t 3000 -o results.txt
  `);
}

// Interactive mode for when no arguments provided
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question("Enter domain pattern (use * for wildcards): ", (domain) => {
      rl.close();
      resolve(domain);
    });
  });
}

// Main execution
async function main() {
  const options = parseArguments();

  if (options.help) {
    showHelp();
    return;
  }

  let domain = options.domain;

  // If no domain provided, use interactive mode
  if (!domain) {
    console.log("No domain pattern provided. Starting interactive mode...\n");
    domain = await interactiveMode();
  }

  if (!domain) {
    console.error("❌ No domain pattern provided. Use --help for usage information.");
    process.exit(1);
  }

  // Validate domain pattern
  if (!domain.includes('.')) {
    console.error("❌ Invalid domain pattern. Domain must include a TLD (e.g., .com, .org)");
    process.exit(1);
  }

  // Create and run domain finder
  const finder = new DomainFinder({
    concurrentChecks: options.concurrentChecks,
    timeout: options.timeout,
    outputFile: options.outputFile
  });

  try {
    await finder.findAvailableDomains(domain);
  } catch (error) {
    console.error("❌ An error occurred:", error.message);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Process interrupted by user. Exiting...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch(console.error);