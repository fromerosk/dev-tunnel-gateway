#!/usr/bin/env node

import { parseCLIArgs } from './args';
import { ConnectionManager } from './connection';
import { SessionManager } from './session';
import { RequestForwarder } from './forwarder';
import { ShutdownHandler } from './shutdown';

async function main(): Promise<void> {
  const config = parseCLIArgs();

  process.stdout.write(`Dev Tunnel Gateway Client\n`);
  process.stdout.write(`Gateway: ${config.gatewayUrl}\n`);
  process.stdout.write(`Local port: ${config.localPort}\n`);
  process.stdout.write(`Connecting...\n`);

  const connection = new ConnectionManager(config.gatewayUrl, config.authToken);

  await connection.connect();

  const session = new SessionManager(connection, config.localPort);

  await session.register();

  const forwarder = new RequestForwarder(connection, config.localPort);
  forwarder.start();

  const shutdown = new ShutdownHandler(connection, () => forwarder.inFlightCount);
  shutdown.register();

  session.startHeartbeat();

  connection.on('failed', (reason: string) => {
    process.stderr.write(`Connection failed: ${reason}\n`);
    process.exit(1);
  });
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
