#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const args_1 = require("./args");
const connection_1 = require("./connection");
const session_1 = require("./session");
const forwarder_1 = require("./forwarder");
const shutdown_1 = require("./shutdown");
async function main() {
    const config = (0, args_1.parseCLIArgs)();
    process.stdout.write(`Dev Tunnel Gateway Client\n`);
    process.stdout.write(`Gateway: ${config.gatewayUrl}\n`);
    process.stdout.write(`Local port: ${config.localPort}\n`);
    process.stdout.write(`Connecting...\n`);
    const connection = new connection_1.ConnectionManager(config.gatewayUrl, config.authToken);
    await connection.connect();
    const session = new session_1.SessionManager(connection, config.localPort);
    await session.register();
    const forwarder = new forwarder_1.RequestForwarder(connection, config.localPort);
    forwarder.start();
    const shutdown = new shutdown_1.ShutdownHandler(connection, () => forwarder.inFlightCount);
    shutdown.register();
    session.startHeartbeat();
    connection.on('failed', (reason) => {
        process.stderr.write(`Connection failed: ${reason}\n`);
        process.exit(1);
    });
}
main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map