# Squarelands

[中文](readme.md) · [Gameplay and balance](GAMEPLAY.md) · [Development](DEVELOPMENT.md) · [Downloads](https://github.com/stalyx-meow/Squarelands/releases)

A multiplayer city-building and trading game with a standalone Electron client and server. Players enter the server IP or domain to join a persistent shared world. The current version is **1.2.0**. Check the version when downloading; 1.1.0 packages do not include these new features.

## What is new

- Automatic intercity supply, including funds, using real freight costs and transport workers.
- Full resource inventories in a responsive grid, raw ores, smelters/refineries, fuel and expanded food/clothing chains.
- Manual territory claims; city upgrades increase capacity. Maps expand near claimed borders.
- Per-player transit policies and automatic sale thresholds per resource.
- City sales, purchases, border walls and infiltration with a visible success probability.
- Broadcasts and private messages.
- Chinese and English UI and an in-game handbook populated from current server settings.
- Root administration with 421 editable numeric fields, validation, atomic persistence and reset to defaults.

## Play

1. Open **Squarelands Server**. Its default configuration starts a world on `0.0.0.0:3210`.
2. Save the initial root password shown once in the console. Share the LAN address with players.
3. Open **Squarelands Client**, enter the server address, then sign in or register.
4. For play on the same computer, use `127.0.0.1:3210`.
5. Found your first city on unclaimed plains, hills or plateau. Secure food, water and power, then clothing, vegetables, staple food and processed meat. Use the shop while building supply chains.
6. Click **?** for the full English handbook. Use the language button to switch languages; the preference is remembered locally.

Both apps bundle their runtimes. Windows x64 and macOS use ZIP packages; Linux x64 uses tar.gz. Keep the complete extracted directory. macOS supports separate Apple Silicon and Intel packages. Packages are unsigned; Linux GUI apps require a desktop environment. A headless server can run from source.

Bare hosts default to HTTP port 3210. Explicit schemes use their normal default port; explicit ports such as `example.com:80` are honored. HTTPS and IPv6 are supported. Do not include a path, credentials, query string or fragment.

## Administration

Sign in as root inside the game and open **Admin → World parameters**. Categories and search cover prices, inventories, buildings, terrain, workforce, consumption, transport, trade, map expansion and infiltration. Changes are saved with the world. Starting stock applies to new cities; initial map dimensions apply to newly reset worlds. Existing payments, collateral, penalties and dispatched shipments retain their locked values. Lowering capacity does not delete existing stock.

The server console starts/stops the world, shows connection addresses, opens the save folder and makes backups after shutdown. Stop and back up before upgrading. Never run two servers against the same database. Schema v2 preserves existing terrain, inventories and contract ledgers and saves the original legacy JSON before migration. Corrupted balances cause an explicit startup error rather than silent resets.

Broadcasts are public. Private messages are visible only to sender and recipient, including when a third-party root views messages. Message retention is limited. Player names, city names and messages stay in their original language. Server logs retain their original text for troubleshooting.

## Development

Requires Node.js 24+.

```sh
npm ci
npm run server:app
# In another terminal:
npm run desktop
```

For a headless server:

```sh
HOST=0.0.0.0 PORT=3210 DATA_DIR=/path/to/world npm run server
```

For HTTPS reverse proxies, preserve Host and explicitly configure `TRUSTED_PROXIES` with only controlled proxy IPs/CIDRs before trusting forwarded client IPs. Use Secure Cookie only behind HTTPS.

```sh
npm run check
npm test
npm run pack        # Both apps for the current platform
npm run pack:all    # Eight default packages from macOS
```

The release workflow builds Windows x64, Linux x64, macOS arm64 and macOS x64 for both roles. Cross-compilation does not substitute for testing on each target platform. See [development documentation](DEVELOPMENT.md) for deployment, proxy and packaging details.

Licensed under [MIT](LICENSE).
