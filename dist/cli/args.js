"use strict";
/**
 * CLI argument parser for the Dev Tunnel Gateway client.
 *
 * Parses --gateway-url, --token, and --port flags from process.argv.
 * Validates that all required fields are present and port is in [1, 65535].
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArgs = parseArgs;
exports.parseCLIArgs = parseCLIArgs;
const USAGE = `Usage: dev-tunnel --gateway-url <url> --token <token> --port <number>

Options:
  --gateway-url  WSS endpoint URL of the tunnel gateway (required)
  --token        Authentication token (required)
  --port         Local port to forward traffic to, 1-65535 (required)`;
/**
 * Parse CLI arguments into a CLIConfig without calling process.exit.
 * Returns either a valid CLIConfig or an object with an error message.
 * This function is pure and testable.
 */
function parseArgs(argv) {
    let gatewayUrl;
    let authToken;
    let portStr;
    for (let i = 0; i < argv.length; i++) {
        switch (argv[i]) {
            case '--gateway-url':
                gatewayUrl = argv[++i];
                break;
            case '--token':
                authToken = argv[++i];
                break;
            case '--port':
                portStr = argv[++i];
                break;
        }
    }
    // Check for missing required fields
    const missing = [];
    if (!gatewayUrl)
        missing.push('--gateway-url');
    if (!authToken)
        missing.push('--token');
    if (!portStr)
        missing.push('--port');
    if (missing.length > 0) {
        return { error: `Missing required argument(s): ${missing.join(', ')}\n\n${USAGE}` };
    }
    // Validate port
    const port = Number(portStr);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return { error: `Invalid port "${portStr}": must be an integer between 1 and 65535` };
    }
    return {
        gatewayUrl: gatewayUrl,
        authToken: authToken,
        localPort: port,
    };
}
/**
 * Parse CLI arguments from process.argv and exit with code 1 on error.
 * This is the main entry point used by the CLI binary.
 */
function parseCLIArgs() {
    // Skip first two args (node binary and script path)
    const result = parseArgs(process.argv.slice(2));
    if ('error' in result) {
        process.stderr.write(result.error + '\n');
        process.exit(1);
    }
    return result;
}
//# sourceMappingURL=args.js.map