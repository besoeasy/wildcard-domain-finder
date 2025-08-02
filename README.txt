WILDCARD DOMAIN FINDER
======================

A command-line tool to find available domain names using wildcard patterns.

DESCRIPTION
-----------
This tool allows you to search for available domain names by using wildcard patterns. 
It uses DNS lookups to check if domains are registered/reachable and saves available 
domains to a text file.

INSTALLATION
------------
Via NPX (no installation required):
npx wildcard-domain-finder

USAGE
-----
Basic usage:
npx wildcard-domain-finder "test*.com"

With options:
npx wildcard-domain-finder --domain "my*site.org" --concurrent 20

Interactive mode (if no domain provided):
npx wildcard-domain-finder

EXAMPLES
--------
npx wildcard-domain-finder "blog*.com"
npx wildcard-domain-finder "*shop.net"
npx wildcard-domain-finder "sub*.example.*"

OPTIONS
-------
-d, --domain      Domain pattern with wildcards (*)
-c, --concurrent  Number of concurrent DNS checks (default: 10)
-t, --timeout     DNS timeout in milliseconds (default: 5000)
-o, --output      Output file name (default: available_domains.txt)
-h, --help        Show help message

WILDCARDS
---------
Use * in your domain pattern to represent any single character from:
abcdefghijklmnopqrstuvwxyz0123456789

Examples:
- "test*.com" checks: testa.com, testb.com, test1.com, etc.
- "*domain.org" checks: adomain.org, bdomain.org, 1domain.org, etc.
- "my*site.*" checks multiple TLDs and subdomains

OUTPUT
------
Available domains are saved to "available_domains.txt" (or custom file with -o option).
The tool shows real-time progress with statistics and recently found domains.

FEATURES
--------
- Real-time progress display with progress bar
- Concurrent DNS checking for faster results
- Customizable timeout and concurrency settings
- Error handling for network issues
- Interactive mode when no arguments provided
- Graceful handling of interruption (Ctrl+C)

AUTHOR
------
besoeasy

LICENSE
-------
ISC

REPOSITORY
----------
https://github.com/besoeasy/wildcard-domain-finder

ISSUES
------
https://github.com/besoeasy/wildcard-domain-finder/issues
