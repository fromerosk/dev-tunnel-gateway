/**
 * CLI argument parser for the Dev Tunnel Gateway client.
 *
 * Parses --gateway-url, --token, and --port flags from process.argv.
 * Validates that all required fields are present and port is in [1, 65535].
 */
/** Typed configuration returned by the argument parser on success. */
export interface CLIConfig {
    gatewayUrl: string;
    authToken: string;
    localPort: number;
}
/** Result of parsing arguments — either a valid config or an error message. */
export type ParseResult = CLIConfig | {
    error: string;
};
/**
 * Parse CLI arguments into a CLIConfig without calling process.exit.
 * Returns either a valid CLIConfig or an object with an error message.
 * This function is pure and testable.
 */
export declare function parseArgs(argv: string[]): ParseResult;
/**
 * Parse CLI arguments from process.argv and exit with code 1 on error.
 * This is the main entry point used by the CLI binary.
 */
export declare function parseCLIArgs(): CLIConfig;
//# sourceMappingURL=args.d.ts.map