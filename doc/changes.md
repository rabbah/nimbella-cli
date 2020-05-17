# Nimbella CLI (and Workbench) Change History

## Changes in release 1.1.0

- add subcommands `nim web [create | get | delete | clean ]`
- improvements to `project create`
- improvement to `help` and "not found" behavior
- fix bug in `namespace clean that caused `404.html` to have wrong content type
- removed some confusing internal-use commands from top menu
- `activation list` with no arguments defaults to `--last`
- fix bug and also documentation error for symbolic substitution in `project.yml`

## Changes in release 1.0.3

- `project deploy` once again working in the workbench (GitHub only)
- support some new topic aliases (e.g. `kv` for `key-value`)
- `auth current` now supports a `--web` flag showing the web URL
- `nim object ...` accepted as well as `nim objects`
- the namespace may be omitted on `nim logout` (defaults to current, causes a prompt)
- documentation of the `limits` clause in `project.yml` is clarified
- improvements to the output of `activation list` and `action list`
- `nim project deploy` more consistently sets non-zero exit code after errors
- improved error reporting when deploying multiple projects
- the `nim` command in the workbench behaves more like a real command
  - it is still optional
  - the odd `nim-cmds` command is removed ... just type `nim`
- `activation list` in workbench defaults to 10 activations instead of 30, results in better use of horizontal space in graphical section of the output
- excessive command echoing reduced during workbench startup

## Changes in release 1.0.2

- fix pagination and tooltips in the `activation list` view in the workbench
- fix `?` button in the upper right corner of workbench
- adjustments to limits help text and documentation
- `project deploy` is removed from the workbench, to be re-instated in a future release
  - no change to `project deploy` in the CLI
- workbench response for partial matches to an unrecognized command is improved
- better experience for a user creating a new account using `nim auth login`

## Changes in release 1.0.1

- superceded by 1.0.2

## Changes in release 1.0.0

- general cleanup and small bug fixes
- the intent is to observe semantic versioning rules going forward

## Changes in release 0.1.18

- new commands `objects create`, `objects get`, `objects clean`, and `objects delete` have been added and there are improvements to `objects list` and `web list`.

## Changes in release 0.1.17

- the `nim info` command now has options to show the available runtime kinds and the current limits
- the syntax for "dictionary substitution" (previously called "multiple variable substitution") is changed; the former syntax is still accepted but deprecated
- `nim project create` supports `--language typescript` and all samples now use a `body:` tag to make invocation via a URL friendlier
- output improvements to `nim auth list`, other `nim * list` commands and `nim action get`

## Changes in release 0.1.16

- deploy from github is now documented and will work in the workbench too provided there are no builds that require forking processes
- new command subtree `nim workbench` and new ways of moving credentials between `nim` and workbench
- improvements to the output of many `nim * list` commands
- the `webSecure=true` option in `project.yml` now works as originally intended (does _not_ generate a random secret but forces the use of OpenWhisk authentication)
- some error handling improvements (duplicate messages are better avoided now)
- the `nim key-value *` commands are revised to be more complete and more syntactically consistent with other entity management commands
- it is possible to turn on cacheing of web content via a flag in `project.yml`.
  - Cacheing remains off by default.
  - Historically, cacheing has been off unconditionally in recent releases although it was once on unconditionally.
- the `nim action invoke` command now waits for a result by default instead of returning an activation id to be polled.
- the prohibition against `nim auth login` with the `--auth` flag is relaxed to allow it when it would not be destructive
- an action directory that specifies no files to be included is now an error rather than deploying an empty zip


## Changes in release 0.1.15

- some bug fixes
- user agent headers are set consistently when invoking Nimbella and Github services
- the macos installer no longer triggers security warnings (these were happening in releases 0.1.12 - 0.1.14 due to changes in dependencies that were beyond our control but are since fixed)

## Changes in release 0.1.14

- the flags `--include` and `--exclude` are now accepted in `nim project deploy` and `nim project watch`.  Documentation added.
- the table of contents in the "how to" document is now in a sidebar
- use of `nim auth login --auth` is prohibited when the denoted namespace already exists (avoids a possibly destructive user error)
- `nim` now checks values in `project.yml` that should be dictionaries to be sure that they are
- deploying a project from github no longer uses local storage if the project does not require building
    - deploy from github is still considered experimental and not yet documented
    - it _almost_ works in the workbench, getting there
- the `nim auth login` and `nim auth github` commands now use oauth flows and assistance from the Auth0 service when logging or attaching github accounts
  - this is not in full production and may or may not be documented when release 0.1.14 is declared
- the `--verbose` flag has improved behavior and just increases verbosity regarding errors rather than opening a flood of information
  - the intent is to use `--debug` or `DEBUG=` to enable other forms of verbosity
- the identifier `help` when not in the "command" position will no longer be interpreted as if you typed `--help`
- a correction to the output of `activation result`

## Changes in release 0.1.13

- web content is now deployed with cache-control set to 'no-cache' for less surprising behavior during development
    - in the future we will provide a way to turn on cacheing for content in production
- remove `nim project github` and add `nim auth github` instead
    - this eliminates the "alias" concept for github locations but substitutes convenient management of github credentials
    - also change how github locations are specified on deploy
    - deploy from github is still considered experimental and not yet documented
- improve error handling for illegal flags
- improve error message when no current namespace
- support 'web' property of package in `project.yml`, distributes over all actions in the package
- new commands to list contents of object store, web bucket, and key-value store
    - still under development and not yet documented
- use less concurrency in running action builds to avoid blowing file handle limits

## Changes in release 0.1.12

- Substantial documentation style and organization improvements
- Document clarifies that unquoted values in `project.yml` can have varying types by YAML rules
- Where it makes sense, commands with omitted required arguments display help
- `project create` is now documented
- Streamlined syntax for multiple symbol substitution in `project.yml`
- `package delete --recursive`
- fixes to `route` commands
- fix bug that caused `project watch` to misbehave when `--env` was specified
- fixes to `trigger` commands and to `activation list` for triggers
- added `nim info --changes`
- a `targetNamespace` directive or the `--target` flag affects only the current deploy operation and does not change the current namespace for later deploys

## Changes in release 0.1.11
- Release 0.1.11 supports web deployment to the current Nimbella platform (older releases do not)
- Fixed bug in `environment` property as applied to packages
- Fix `action invoke` mis-behavior when asynchronous
- Hide `debug` flag in most help menus
- Institute the change log



