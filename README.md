# ShortStack

Easily create and manage stacked pull requests

## Setup

```
npm install
```



## Developing

Setting up for development:

1. In a sister folder, set up a repo called "tester"
2. At a command prompt, cd into the tester folder and run:
    `npm link [path to shortstack project] --force`
   This adds "shortstack" to your available commands

To Debug:

1. Add breakpoints
2. Build the project and run npm link command in tester folder
3. Run shortstack command with /debug parameter
4. When shortstack pauses, run the "Attack by process ID" option in the VSCode debugger
5. Pick the node process with the /debug parameter, then press Enter in the tester window



## Usage

```
npm start
```

