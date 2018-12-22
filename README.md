## Project structure

```
app/ - Compiled to directory (~ will get overwritten ~)
node_modules/ - Included packages
src/ - All project code
```

## Commands for working on integration

To build (compile only):

> `yarn run build`

To build upon changes to repo code (inside `/src`)

> `yarn run dev`

To start the application

> `yarn run start` -or- `node ./app/index.js`

## Additional notes (WIP)

General notes on running the application with the built in debug turrned on to see
console output.


### Working on Windows

Example output: 
```ps
PS F:\GitHub\lovensediscordintegration> yarn run dev:ps
yarn run v1.10.1

$ @powershell -Command $env:DEBUG='lovense-discord-bot'; node ./app/index.js
  lovense-discord-bot just a test... getting things setup +0ms
Done in 0.79s.

PS F:\GitHub\lovensediscordintegration>
```

### Other platforms or CLIs

See [https://www.npmjs.com/package/debug] for the correct ENV commands