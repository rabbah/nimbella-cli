# Nimbella CLI (and Workbench) Change History

## Changes in release 1.11.1

- fix internal bug
    - asymptomatic now but could surface the next time the runtimes are rebuilt

## Changes in release 1.11

- `nim doc` now directs you to the Nimbella documentation site
- `nim project create` now accepts full language names (`python`) as well as abbreviations (`py`)
- `nim project deploy` with `--remote-build` will run builds in the cloud and `project deploy` in the workbench will do that by default
    - there are limitations on running time (2 minutes) and memory (768mb)
    - a few runtimes (`deno` and `dotnet`) are not supported
- `nim key-value get` pretty-prints a JSON result when parsable JSON is detected
- `nim key-value del` is now an alias for `nim key-value delete`
- the `--namespace` flag is now accepted on all `nim object` and `nim web` commands, not just `list`
    - the optional argument to specify a namespace other than current is now hidden and deprecated in favor of the flag
- sequences are supported in `nim project deploy`
    - documentation to appear shortly in `docs.nimbella.com`
- Adobe I/O Runtime version 3.0 was adopted, replacing 1.7.3, bringing many fixes and improvements
    - also some minor syntax changes.  See the `nim` command summary on `docs.nimbella.com`.
- fixed a bug in project create with existing empty directory
- fixed a bug where deploying large amounts of web content could overwhelm the storage server and cause socket hangups
- eliminated some vulnerabilities reported by `npm audit`
- fixed a workbench bug where `nim object --help` did not work though `object --help` worked fine
- fixed a bug causing annotations of one action to also appear on others when certain syntactic features of YAML were used in `project.yml`
- fixed a bug causing a runaway cascade of "still building" messages for long-running and verbose builds

## Changes in release 1.10.2

- fixed bug that sometimes interfered with using `nimbella-cli` as a dependency in `package.json`

## Changes in release 1.10.1

- security improvement to Linux installer
- rebuild with latest runtime repertoire (includes the .net runtime)

## Changes in release 1.10

- added `--web` flag to `nim action invoke`
    - requires the action to be a web action
    - "invokes" the action by visiting its URL
    - in the CLI this is done using the system default browser
    - in the workbench, content displays initially in the sidecar, with a URL hotlink that optionally switches to a separate browser tab.  The sidecar display is for inspection and is not interactive
- added `--save-env` flag to `nim action get`
- fixed unfriendly exception response for `edit` of non-existent action in the workbench
- eliminated confusing behavior in `nim auth refresh` when API host is specified with current namespace
- the `[action|package|...]` list commands in the workbench now use the same sorting as in the CLI
- prompting when using an abbreviated namespace now includes the API host
- improvements to the (undocumented) action wrapping capability
- fixed a bug in the feature that allows projects to own namespaces

## Changes in release 1.9.3

- Fix bugs in `nim auth refresh` and `nim commander`

## Changes in release 1.9.2

- `nim action get <name> --url` provides a better answer for use in front-end code
- an abbreviated namespace name that is ambiguous now prompts instead of terminating the command
- we fixed a bug that caused `--include` not to work for individual action names
- on `nim project deploy`, when `--env` names a non-existent file, the deployment terminates earlier with a clearer message
- when an action, package, rule, or trigger is displayed in the workbench sidecar, the delete button now works correctly
- when you issue `new <pkg>/<action>` in the workbench and `<pkg>` doesn't exist, you get an immediate informative error instead of an opaque one when deploying

## Changes in release 1.9.1

- fix some errors in installation as a dependency
- some purely internal changes preparatory to the next feature release

## Changes in release 1.9

- a `nim auth refresh` command has been added
- improvements to error reporting for problems accessing `web` and `object` resources
- installs using `npm` or `yarn` should now work on windows
    - note that we still recommend using an installer, not `npm` or `yarn` when installing globally
- fixed bug: some commands that end in error were setting 0 exit code instead of non-zero
- fixed bug: there were occasional crashes of `nim project watch` on macos
- contents of a `.git` folder are now ignored by `nim project watch`
- some bug fixes in `nim commander`
- improvements to `nim activation get` and `nim activation logs` (supports ranges)
- vulnerabilities reported by `npm audit` have been eliminated
- fixed error in the `swift` template for new actions in the playground
- when using the `nim` prefix explicitly in the workbench, aliases are now recognized correctly

## Changes in release 1.8

- deploying to github without registered github credentials requires an explicit flag
- minor style improvements to documentation
- better separation of credential management when also using the `wsk` binary
- removing `webSecure` from `project.yml` now causes reversion to the default (as intended by design)
- fix the parsing of zip file names when determining the runtime
- fix some bugs in `nim plugins` with no arguments and in using plugins with `nim project create`
- actions that list openwhisk resources (e.g.) `nim actions list` support a `--count` flag
- `nim action create` accepts `--native` flag
- when `--web` is used on `nim action [ create | update ]` the `final` annotation is also set to `true`
- `nim auth export` accepts a `--json` flag
- further improvements to `nim logout` for multiple logouts
- improvements to some error messages

## Changes in release 1.7

- improvements to `nim [web|object] create` and addition of  `nim [web|object] update`
- `nim [web|object|key-value] list` now uses optional `--namespace` flag in lieu of positional argument
- fixed bug in error display for `nim key-value` commands that use illegal keys
- improved formatting of `nim auth list`
- documentation layout improvements for mobile devices
- workbench menu has entries for `action list` and `activation list` once you are logged in
- catch a common user error when deploying web content built with `react` or similar tools
    - for the web, if there is a `node_modules` but no `.include`, deployment is aborted.
    - Typically, `node_modules` is there for tool and not part of the intended web site
    - Use `.include` if you really want to include `node_modules`
- better error message when a file listed in `.include` does not exist
- ignore `binary` setting of `false` in `project.yml` when the result of a build is a zip file.  The build knows best.
- enable the latest postman plugin, which includes key management
- commands that operate only on OpenWhisk resources, and that specify both `--apihost` and `--auth`, work even without a current namespace
- the playground now supports "extended samples" more interesting than the minimal "hello" ones.  One has been added for image resizing.

## Changes in release 1.6.1

- fixed bug that often caused installs using `npm` or `yarn` to fail
    - note that we still recommend using an installer, not `npm` or `yarn` when installing globally
- some internal refactoring, should not be visible
- returned the minimum `node` version to 10.0
    -  it had briefly and ill-advisedly been increased to 12.0 in release 1.6.0.

## Changes in release 1.6

- 'nim commander' is added, providing CLI-level access to Nimbella Commander.
- fixed bug causing duplicate execution of some commands in the workbench
- sample text when using the 'new' command is improved

## Changes in release 1.5

- fixed bug in `nim action update` with `--web-secure=true`
- implemented `environment` as a top-level project parameter
- fixed bug in `new` command in the workbench
- fixed workbench bug when clicking on the namespace name in an activation view
- fixed bug in `--incremental` support when `package.json` contains a `build` script

## Changes in release 1.4

- added 'nim object url'
- fixed activation summary view in workbench
- fixed clipping at the bottom of the table of contents of 'nim doc (and changed title)'
- fixed behavior of 'nim project watch' on linux
- fixed display of some characters on windows in 'nim [ action | activation ] list'

## Changes in release 1.3.2

- fixed bug in 'deploy from github' when initiated from workbench (web content  did not get an appropriate content type)

## Changes in release 1.3.1

- When running a `build` script in `package.json`, the preceding install now includes dev dependencies.  The feature as implemented in  `1.3.0` was not useful for its intended purpose.

## Changes in release 1.3.0

- it is now possible to tie namespaces to projects
- builds triggered by `package.json` will run a `build` script (if present) after install
- commands that take an indefinite number of arguments now work correctly in the workbench
- add --url option to `web get`
- fixed bug in save/revert in the workbench editor
- fixed command-not-recognized when the first thing issued in the workbench is a topic alias
- fixed checkmark appearance in windows for `auth list`
- timeouts now appear in `activation list`

## Changes in release 1.2.0

- fix handling of command and topic aliases in the workbench (they are now equivalent to the CLI)
- `login` and `logout` are now aliases for `auth login` and `auth logout`
- improved output from commands that list entities
- on `action create` the action name may be omitted if it can be inferred from the file name
- `web get` and `object get` behavior is more equivalent to each other
- some formatting improvements to error reporting
- fix problems when a tool (like `npm` or `react`) generates an included directory containing symlinks
    - this does not imply general support for symlinks as a way to assemble projects; that is still unsupported
- `logout` accepts lists of namespaces and an `--all` flag

## Changes in release 1.1.0

- add subcommands `nim web [create | get | delete | clean ]`
- improvements to `project create`
- improvement to `help` and "not found" behavior
- fix bug in `namespace clean` that caused `404.html` to have wrong content type
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



