% How To Use the Nimbella Command Line Tool
%
%


The **Nimbella Command Line Tool** (`nim`) is your primary portal to Nimbella services.

_`nim` is not yet announced to Nimbella customers; we are trying it out internally for now_

This document is in the early stages of construction.
`nim`
## A very quick overview.

```
 > nim
A comprehensive CLI for the Nimbella stack

VERSION
  nimbella-cli/0.1.0 darwin-x64 node-v11.15.0

USAGE
  $ nim [COMMAND]

COMMANDS
  action        work with actions
  activation    work with activations
  auth          manage Nimbella namespace credentials
  autocomplete  display autocomplete installation instructions
  doc           display the full documentation of this CLI
  help          display help for nim
  info          show information about this version of 'nim'
  namespace     work with namespaces
  package       work with packages
  project       manage and deploy Nimbella projects
  route         work with routes
  rule          work with rules
  trigger       work with triggers
  update        update the nim CLI
```

#### wsk-like commands

The `action`, `activation`, `namespace`, `package`, `route`, `rule` and `trigger` commands introduce subcommand trees very similar to the `wsk` CLI.  The `wsk` command uses `api` rather than `route` and has some other subtrees that are not provided by `nim` because they do not fit Nimbella's model for managing credentials and deployment.  The subtrees in this list that we do provide are built on the Adobe I/O (`aio`) open source project.  Note that the `project` subtree of `nim` is _not_ the same as the `project` subtree of `wsk`.

#### Credential Management

The `auth` subtree give you management of Nimbella credentials.  Nimbella does not regard `.wskprops` as canonical and replaces it with a more flexible "credential store."  The `nim auth` commands will write `.wskprops` as a courtesy in case you also want to use `wsk`.

```
 > nim auth
Manage Nimbella namespace credentials

USAGE
  $ nim auth:COMMAND

COMMANDS
  auth:list    List all your Nimbella Namespaces
  auth:login   Gain access to a Nimbella namespace
  auth:logout  Drop access to a Nimbella Namespace
  auth:switch  Switch to a different Nimbella namespace
```

Notice the use of colon separators between segments of a command name.  This happens because `nim` is based on `oclif` (the Open CLI Framework from Heroku, which is also used by `aio`).  While `oclif` regards colons as canonical, we have logic that _usually_ permits you to use blank separators as in most popular CLIs.

```
 > nim auth list
```

#### Project Managment

The `project` subtree currently contains only one command (`project deploy`) which Nimbella customers use to manage and deploy _projects_ containing a mixture of OpenWhisk resources and web resources.  More commands are planned.  The code under this command is also packaged for the moment as a separate CLI called `deployProject`.   The `deployProject` CLI will be phased out but, for the moment, it is its documentation that you must consult in order to understand how to organize projects.  [Here is a link](https://apigcp.nimbella.io/downloads/doc/deployer.html) to that documentation.

To a first approximation, the command `nim project deploy` is equivalent to the command `deployProject` as used in the deployer documentation.  However, the following differences should be kept in mind.

- the `--login` flag is not supported; use `nim auth login`
- the `--target` flag is not supported unless accompanied by a project list; use `nim auth switch`
- the `--forget` flag is not supported; use `nim auth logout`
- the `--credentials` flag is not supported; use `nim auth list`
- the `--version` flag is not supported; use `nim info`
- the `--doc` flag is not supported; use `nim doc` (which shows this document)
- the `--verbose-errors` flag is not supported; instead, all commands in `nim` accept a `--verbose` or `-v` flag, which has a similar effect

The project structure is the same, however, and, to a very great extent both `deployProject` and `nim project deploy` run the same code.




