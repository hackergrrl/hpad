# hpad

> Create and edit peer-to-peer documents with your favourite text editor, then
> sync them to peers from the command line!

A command line version of the (wip) web app
[hyperpad](https://github.com/noffle/hyperpad).

## Example

```
eliza$ hpad init foo.markdown
[8029129c219e9ff63901f4f9] created hyperpad for foo.markdown

eliza$ vim foo.markdown
(edit edit edit)

eliza$ cat foo.markdown
hello world

eliza$ hpad seed foo.markdown
[8029129c219e9ff63901f4f9] joining swarm for foo.markdown

Press CTRL+C to terminate synchronization..

jorge$ hpad clone 8029129c219e9ff63901f4f9
[8029129c219e9ff63901f4f9] joining swarm for 8029129c219e9ff63901f4f9
found peer 10.30.66.206|3497
replicating to peer 10.30.66.206|3497.. done!

jorge$ atom foo.markdown
(edit edit edit)

jorge$ cat foo.markdown
hello world!
wow p2p so fresh

jorge$ hpad seed foo.markdown
[8029129c219e9ff63901f4f9] joining swarm for foo.markdown
found peer ::ffff:10.30.66.206|3259
replicating to peer ::ffff:10.30.66.206|3259.. done!

Press CTRL+C to terminate synchronization..

eliza$ cat foo.markdown
hello world!
wow p2p so fresh
```

## Usage

```
USAGE:

  hpad init FILE

    Start backing FILE with hyperpad. Outputs the KEY for the new pad.

  hpad clone KEY

    Create a local copy of a hyperpad document from the swarm.

  hpad seed FILE

    Join the swarm for this document online & on the local network to
    share and exchange updates. Command runs until manually terminated.

  hpad ls

    List all hyperpad documents in the current directory, and their keys.
```

## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install --global hpad
```

## License

ISC

