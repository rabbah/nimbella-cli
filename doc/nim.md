% How To Use the Nimbella Command Line Tool
%
%

This document is organized as follows.

  - [Downloading and Installing](#Installing)
      - [Installing as a `node` dependency using 'npm' or 'yarn'](#NPMInstall)
  - [Introducing the `nim` command](#What)
  - [About Nimbella Projects](#Projects)
  - [Nimbella Accounts and Login](#Login)
  - [Setting up a 'no-configuration' project (actions
    only)](#ActionsOnly)
      - [Actions as Single Files](#Single)
      - [Deployer Record Keeping](#Recording)
      - [About Project Structure](#Structure)
      - [Actions are "web" actions by default](#WebActions)
      - [Of course there can be more than one action](#MoreThanOne)
      - [Zipped actions](#Zipped)
      - [Multi-file actions (with "auto-zip") and renaming
        actions](#AutoZip)
      - ["Linking" action source from elsewhere in the
        filesystem](#Linking)
  - [Deploying Incrementally](#Incremental)
       - [Project watching](#Watch)
  - [Adding Project Configuration](#Configuring)
      - [Symbolic Variables](#SymbolicVars)
      - [File substitution](#FileSubst)
  - [Adding static web content](#AddingWeb)
      - [Limitations, Requirements](#WebLimitations)
      - [The "Action Wrapping" Alternative](#ActionWrapping)
 - [Incorporating build steps for actions and web content](#Building)
      - [Errors in Builds](#BuildErrors)
      - [Out-of-line builds and shared builds](#OutOfLineBuild)
      - [The effect of `--incremental` on Builds](#BuildIncremental)
      - [Examples of building (common use cases)](#BuildExamples)
 - [Managing Multiple Namespaces](#MultiNS)

-----

## <span id="Installing"></span>Downloading and Installing the Nimbella CLI

In the following instructions we assume your intent is to install the Nimbella CLI as a command to be invoked from shells or scripts.  [Below](#NPMInstall) we discuss how to install `nim` as a dependency of another package using `npm` or `yarn`.  We don't recommend installing globally with `npm` or `yarn`.

When using the preferred installation for your system
  - The CLI is self-contained and has no dependencies on previously installed software
  - you get automated update services when new versions are available.

For `mac` and `windows` we provide installers.  To download, click

- [here for mac](https://apigcp.nimbella.io/downloads/nim/macos/nim.pkg)
- [here for windows](https://apigcp.nimbella.io/downloads/nim/win/nim-x64.exe)

After downloading, you must execute the provided installer.

For `linux` we provide a scripted install.  Use

```
curl https://apigcp.nimbella.io/downloads/nim/nim-install-linux.sh | sudo bash
```

When the install completes, do

```
nim update
```

This will first of all verify that `nim` is installed and capable of self-updating.  In most cases, it will say that it already has the latest version.  However, occasionally, the initial install may be of less than the latest version and the update step will correct that.


### <span id="NPMInstall"></span>Local install using npm or yarn

As `nim` is implemented as node package it is also possible to install it with `npm` or `yarn` but we recommend this only for situations where you do not want a global install but rather are making `nim` a dependency of some other package.

```
npm install https://apigcp.nimbella.io/downloads/nim/nimbella-cli.tgz
```
or

```
yarn add https://apigcp.nimbella.io/downloads/nim/nimbella-cli.tgz
```

When installation finishes, you can execute `nim` locally to the package into which is has been incorporated by using

```
npx nim ...
```

When installed in this way, `nim update` will not work: you have to do a fresh install to get later versions.

-----

## <span id="What"></span>Introducing the `nim` command


The **Nimbella Command Line Tool** (`nim`) is your primary portal to Nimbella services.   Typing `nim` at a command prompt will get you something like the following.


```
> nim
A comprehensive CLI for the Nimbella stack

VERSION
  nimbella-cli/0.1.3 darwin-x64 node-v10.16.3

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
The commands divide into four categories.

#### Openwhisk Entity Management commands

The `action`, `activation`, `namespace`, `package`, `route`, `rule` and `trigger` commands each manage the corresponding kind of entity as defined by [Apache OpenWhisk](http://openwhisk.org).  Nimbella powers the "serverless computing" portion of its offering with a modified version of OpenWhisk.  The syntax for these seven commands approximates that of like-named commands of the `wsk` binary provided by the Apache OpenWhisk project, except that `route` is used in place of `api` (the implementation for these commands is derived from the Adobe I/O runtime opensource project).  If you are used to using `wsk`, note that the `project` command of `nim` is not a replacement for `wsk project` (see [About Nimbella Projects](#Projects)).

#### Supporting commands

The `autocomplete`, `doc`, `help`, `info` and `update` commands provide supporting services in either explaining how to do things or updating the CLI to a later version.  Note that `nim update` works only on `mac` and `windows`you installed `nim` with one of the provided installers for `mac` or `windows`.

#### Credential Management

The `auth` subtree gives you management of Nimbella credentials, that is, access to specific Nimbella _namespaces_.

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

Notice the use of colon separators between segments of a command name.  This happens because `nim` is based on `oclif` (the Open CLI Framework from Heroku).  While `oclif` regards colons as canonical, we have logic that _usually_ permits you to use blank separators as in most popular CLIs.

```
 > nim auth list
```

The `nim` command does not regard `~/.wskprops` as canonical, the way the `wsk` binary does, but replaces it with a more flexible "credential store."  The `nim` command _does_ update `~/.wskprops` in synch with the credential store, but does not support other configuration options set via the process environment, such as `WSK_CONFIG_FILE`.  Although `nim` uses the OpenWhisk `nodejs` client internally, it takes steps to nullify the effect of any `__OW_*` variables in the environment to prevent collisions with other uses of the client.  By keeping `~/.wskprops` in synch, `nim` permits you to also use the `wsk` binary, if you like, without further configuration fiddling.  The flexibility of the credential store replaces the other configuration mechanisms.  For more information on managing the credential store see [Nimbella Accounts and Login](#Login) and [Managing Multiple Namespaces](#MultiNS).

#### Project Level Deployment

The `project` command has two subcommands, `deploy` and `watch` which operate on logical groupings of resources (OpenWhisk entities, web content, storage, etc) that make up typical applications.  Such a grouping is called a _project_.  We often use the term _the deployer_ for the parts of `nim` that operate on projects.  Much of the rest of this document concerns itself with projects, hence with the deployer.

```
 > nim project
manage and deploy Nimbella projects

USAGE
  $ nim project:COMMAND

COMMANDS
  project:deploy  Deploy Nimbella projects
  project:watch   Watch Nimbella projects, deploying incrementally on change
```
```
 >   nim project deploy
Deploy Nimbella projects

USAGE
  $ nim project:deploy [PROJECTS]

ARGUMENTS
  PROJECTS  one or more paths to projects

OPTIONS
  -v, --verbose      Verbose output
  --apihost=apihost  API host to use
  --auth=auth        OpenWhisk auth token to use
  --debug=debug      Debug level output
  --env=env          path to environment file
  --help             Show help
  --incremental      Deploy only changes since last deploy
  --insecure         Ignore SSL Certificates
  --target=target    the target namespace
  --verbose-build    Display build details
  --yarn             Use yarn instead of npm for node builds

```
```
 > nim project watch --help
Watch Nimbella projects, deploying incrementally on change

USAGE
  $ nim project:watch [PROJECTS]

ARGUMENTS
  PROJECTS  one or more paths to projects

OPTIONS
  -v, --verbose      Verbose output
  --apihost=apihost  path to environment file
  --auth=auth        OpenWhisk auth token to use
  --debug=debug      Debug level output
  --env=env          path to environment file
  --help             Show help
  --insecure         Ignore SSL Certificates
  --target=target    the target namespace
  --verbose-build    Display build details
  --yarn             Use yarn instead of npm for node builds
```

-----

## <span id="Projects"></span>About Nimbella Projects

A project contains *actions* and associated web content to be deployed together
into a Nimbella host so that they are visible to your end users
(to the extent that you wish). We use the term *action* for a serverless
function, following [Apache OpenWhisk](http://openwhisk.org)
terminology, because the Nimbella stack builds on OpenWhisk.

In Nimbella, as in OpenWhisk, the unit of authorization is called a
[*namespace*](https://github.com/apache/incubator-openwhisk/blob/master/docs/reference.md#namespaces-and-packages). As in all OpenWhisk deployments, a namespace contains
[actions](https://github.com/apache/incubator-openwhisk/blob/master/docs/actions.md), optionally grouped into [*packages*](https://github.com/apache/incubator-openwhisk/blob/master/docs/packages.md). (OpenWhisk has additional entities called [*rules*](https://github.com/apache/incubator-openwhisk/blob/master/docs/triggers_rules.md), [*triggers*](https://github.com/apache/incubator-openwhisk/blob/master/docs/triggers_rules.md), [*routes*](https://github.com/apache/incubator-openwhisk/blob/master/docs/apigateway.md) (aka "API gateway"), and [*activations*](https://github.com/apache/incubator-openwhisk/blob/master/docs/actions.md); the `nim` command supports these individually but, currently, not as part of a project).

Going beyond OpenWhisk, a
Nimbella namespace also contains other resources, such as object store
buckets for web content and database instances, that are managed as part of the
namespace.  In [Nimbella Accounts and Login](#Login), we explain how to obtain your first namespace and in
[Managing Multiple Namespaces](#MultiNS) we discuss how to obtain and manage additional ones.

This document won't explain serverless computing, or OpenWhisk, in
detail, but will supply links to OpenWhisk web pages when it seems that
that might help.

Again, a *project* is simply a grouping of actions and web content
that is intended to be deployed ("installed") as a unit.

  - When deploying a project, all of its actions and web resources are
    installed into a single target namespace.
  - However, an individual project need not specify everything that is
    intended for that namespace (multiple projects can deploy into the
    same namespace).
  - The actions of a project can span multiple packages, and a given
    package can have actions contributed by multiple projects.
  - In other words, *you* decide on project boundaries based on
    deployment convenience.
  - Note that, as a consequence of all this flexibility, we can't guard against collisions between different projects trying to install the same resource.  You need to be careful about that.  We provide some audit trails that can help, described [later](#Recording).

A feature that sets `nim project` apart from many other deployment tools
is that no "manifest" or "configuration file" is required in a large
number of suitably simple cases. You simply choose a directory in the
file system to represent a project and layout the content of the project
under that directory using a structure that `nim` will recognize as a project.

After describing [how to log into Nimbella](Login), we explore the simplest case, [projects containing
only actions and no build steps](#ActionsOnly).  We then discuss [adding web
content](#AddingWeb) to a project. After that we show how to [add build
steps](#Building) to individual actions or the web content of a project.

Because `nim project` can't *always* avoid the need for a configuration
file, we summarize [how to add more information, using a configuration
file](#Configuring) to guide `nim` when the file and directory
structure does not convey everything it needs to know.

-----

## <span id="Login"></span>Nimbella Accounts and Login

If you have previously used the Nimbella Workbench and issued the `login` command there, the steps in this section are unnecessary.

In order to deploy a project (or, for that matter, to use many other `nim` capabilities), you must have permission to use a specific namespace.  The current means of obtaining this permission is to visit
[the Nimbella Early Access Request site](https://nimbella.com/request/), provide a small amount of information, and wait for an email response containing a _login token_ (a very long mostly hexadecimal string).  Then, you use `nim auth` to activate your namespace.

```
 > nim auth login <a very long hexidecimal string provided by Nimbella Corp>
stored a credential set for namespace '...' and API host '...'

```

The place where `nim` stores credential will be called _the credential store_ in this document.  It is shared between `nim` and the workbench.  You should only need to do login once for each namespace (whether this is in the workbench or `nim`).

Assuming nothing goes wrong you should be able to view the credential store as follows.

```
 > nim auth list
Namespace            Current Storage API Host
<your namespace>        yes     yes  https://...
```

As the format implies, you can have multiple namespaces as detailed further in  [Managing Multiple Namespaces](#MultiNS).  The `Current` column will contain a `yes` for just one namespace, which is the one the deployer will deploy to in the absence of other directives.  The `Storage` column indicates whether the namespace has provision for web content storage as discussed in [Adding static web content](#AddinsgWeb).  The initial namespaces provided by Nimbella have storage by default.

If you prefer to use the Apache `wsk` binary (e.g. `wsk activation ...` instead of `nim activation ...`), that should work fine because `nim auth` also updates the file called `~/.wskprops` as needed by `wsk`.  It will look something like this.

```
APIHOST=<a URL>
AUTH=<a long hexidecimal string>
```

The APIHOST field will be match the entry in the API host column for the namespace marked current.  The AUTH field duplicates information that is also found in the credential store for the namespace marked current.

-----

## <span id="ActionsOnly"></span>Setting up a 'no-configuration' project (actions only)

A project containing only actions (with no web content or build steps)
is especially easy to set up. We will start with the very simplest case,
where every action has its code contained in a single file.

### <span id="Single"></span>Actions as Single Files

```
> mkdir -p example1/packages/demo
> cp hello.js example1/packages/demo
> nim project deploy example1

Result of deploying project '.../example1'
  to namespace '...'
  on host 'https://...nimbella.io'
Deployed actions:
  - demo/hello

```

The example assumes you already have `hello.js` containing the complete
source to an action (for more information about actions, see [Apache
OpenWhisk
documentation](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md)).

The deployer names the action based on the file name (stripping the
suffix) and prepending the package qualifier based on the name of the package directory.
In the example, the action has the (package qualified) name
`demo/hello`.

If you want an action to have a simple name (no package
qualification) you put it in a package directory called `default`.  In that case, there
will be no package qualifier prepended.

The deployer determines the kind of runtime required for the action from the file
suffix.   In the example, the deployer uses the `nodejs:default` runtime (inferred from the
suffix `.js`).  Runtimes currently supported by Nimbella are `nodejs` (suffix `.js`),
`python` (suffix `.py`), `java`, `swift`, `php` and `go`. For Java we support
suffixes `.java` for source and `.jar` for a pre-built JAR file.

### <span id="Structure"></span>About Project Structure

As already illustrated, a project has a root directory, within which a certain small number of directory names are significant to the deployer.   _Anything else_ in the root directory will be ignored by the deployer.  So, you can put documentation there, and also directories that will be used by features of the deployer (like building) to store things that need to be "off to the side."

Within the root directory is (among a few other things) the `packages` directory.  In this directory, each subdirectory
represents a package.   Therefore, you can't put other directories (that aren't packages) there.  However, you can put files there, and they will
be ignored by the deployer.

Each subdirectory of `packages` (representing a package) is assumed to contain actions.   As we will see, actions can be represented by either files or directories.  Therefore you need to avoid putting either files or directories there unless they represent actions.

### <span id="Recording"></span>Deployer Record Keeping

The deployer will record its latest
status in a subdirectory of the project called `.nimbella`.  All files in the
`.nimbella` directory are generated by `nim` and should _not_ be
edited by you. If your project is under `git` control, the entire
directory should (probably) be listed in `.gitignore`. Currently, all status is
recorded in a single file called `versions.json`, whose contents should
look something like this.

```
[
  {
    "apihost": "https://...",
    "namespace": "...",
    "packageVersions": {
      "demo": {
        "version": "0.0.1",
        "digest": "ab87f791f2d2..."
      }
    },
    "actionVersions": {
      "demo/hello": {
        "version": "0.0.3",
        "digest": "ca5b7a03c1bb..."
      }
    }
  }
}
```

The `versions.json` file can be used to compare what is actually in your
namespace with what the deployer last deployed from this physical copy
of the project. OpenWhisk increments version numbers for actions and packages on each update,
and the deployer records the last-deployed version locally.
For example, if you later detect that `demo/hello` is at
version `0.0.2` while the deployer last deployed version `0.0.1`, this
means that the action was updated outside the deployer or by some other
project or copy of this project. Disambiguating these cases may require
further inspection of the deployed action.

As you can see, the entry for the package and for each action also includes a `digest` field.  This is used to control [incremental deploying](#Incremental), described in a later section.

If you request one of the options to clean an action, package or namespace prior to deploying (see [Adding Project Configuration](#Configuring)), then the version numbering of the "cleaned" action may start over again at `0.0.1`.

OpenWhisk supports
[annotations](https://github.com/apache/incubator-openwhisk/blob/master/docs/annotations.md)
on actions and packages. The deployer generates an annotation of its own
in each action and package it deploys.

```
> nim action get demo/hello
{

    "namespace": ".../demo",
    "name": "hello",
    "version": "0.0.1",
    ...
    "annotations": [
        {
            "key": "deployer",
            "value": {
                "repository": "...",
                "commit": "...",
                "digest": "...",
                "projectPath": "...",
                "user": "..."
            }
        },
        ...
    ],
    ...
}

```

The details vary according to whether the deployed project is under `git` control.  If the project is managed by `git` then

- `repository` is the value given by `git config --get remote.origin.url`
- `commit` is the githash of the most recent commit, with `++` added if the working copy contains uncommitted changes
- `digest` is the digest of the code and metadata of the action, or the metadata of the package (the same value that is stored locally for controlling incremental deployment)
- `projectPath` is the path of the project within the repository clone (that is, relative to the repository root)
- `user` is the value given by `git config --get user.email`

If the deployed project does not appear to be under `git` control, then the `repository` and `commit` fields will be omitted, the `projectPath` will be absolute, and `user` will be the local user name according to the operating system.

If you deploy to different namespaces or API hosts at different times,
the array in `versions.json` will have more than one entry, with versions
for the last deployment to each distinct API host / namespace target.

### <span id="WebActions"></span>Actions are "web" actions by default

Every action produced by a 'no-configuration' project will be what
OpenWhisk calls ["web
action"](https://github.com/openwhisk/openwhisk/blob/master/docs/webactions.md).
This means the action is publicly accessible via a URL. The URL can
actually be reconstructed from the API host, namespace, and
package-qualified action name, but this is time-consuming. You can use
the `nim action get` command to retrieve the URL of a web action, as in

```
> nim action get demo/hello --url
https://....nimbella.io/api/v1/web/.../demo/hello

```

There can be good reasons why you don't want your actions to be web
actions. However, to label actions as non-web requires the use of
[configuration](#Configuring) as explained below.

### <span id="MoreThanOne"></span>Of course there can be more than one action

Adding more (single file) actions to a project is easy. Just create more
package directories, as needed, and add the actions to them.  Assuming example1 as shown previously

```
> mkdir example1/packages/admin
> cp adduser.js example1/packages/admin
> mkdir example1/packages/default
> cp sampleJavaScript.js samplePython.py welcome.js example1/packages/default
> mkdir example1/packages/test
> cp work0.js work30.js example1/packages/test
> nim project deploy example1

Result of deploying project '.../example1'
  to namespace '...'
  on host 'https://...nimbella.io'
Deployed actions:
  - admin/adduser
  - sampleJavaScript
  - samplePython
  - welcome
  - demo/hello
  - test/work0
  - test/work30

```

There is no limit on how many packages and actions can be in a project; ideally, a project will represent a logical unit of functionality whose boundaries are up to you.  The default behavior of the deployer (to deploy _everything_ in the project) can then be somewhat time-consuming.  The (incremental deployment)[#Incremental] option is designed to overcome that problem.

An alternative to creating large projects is to create small ones.  The `nim project deploy` command accepts a list of projects in a single invocation.

```
> nim project deploy example1 example2 ...
```

Of course, having lots of small projects complicates building and you only get fine-grained behavior by specifying the projects manually.  The incremental option allows you to have "right sized" projects without overly long deployment steps during iterative
development.

### <span id="Zipped"></span>Zipped actions

OpenWhisk supports actions in which there are multiple source files,
zipped together. You can provide a "single file" action in this way, as
long as its suffix is `.zip`.
Since the `.zip` suffix does *not* convey the
kind of runtime required, you form the name using two dots. Thus, the
name `hello.nodejs.zip` can be used for a zipped action whose action
name is *hello* and whose runtime kind is `nodejs:default`. You can also
select a non-default runtime version (e.g. `hello.nodejs-8.zip`) if
Nimbella supports it.

When you make your own zipped actions, you will typically create the
zips in a separate build step. As will be seen, there are alternatives
that may be preferable depending on your overall needs.

Some language runtimes, e.g. Java, also
accept specialized archives (e.g. `.jar` files) or may directly accept binary
executables.  Where this is indicated by the extension, it the extension will
still imply the language runtime (as in the Java case).  Other cases are not
specially handled by `nim` and might requiring using [configuration](#Configuring).

### <span id="AutoZip"></span>Multi-file actions (with "auto-zip")

An alternative to making your own zipped actions is presented in this
section. Let's alter example 1 a little bit.

```
> mkdir -p example2/packages/demo/hello
> cp helloMain.js helloAux.js example2/packages/demo/hello
> nim project deploy example2

Result of deploying project '.../example2'
  to namespace '...'
  on host 'https://...nimbella.io'
Deployed actions:
  - demo/hello
```

As the example shows, an action can be a *directory* instead of a single
file. The action will be named for the directory. The files in the
directory are then zipped automatically to form the action. For this to
work in a 'no-configuration' project, at least one file must have a
suffix from which the runtime kind can be inferred and there may not be
multiple suffixes suggesting different runtime kinds. In addition,
exactly one file must contain an identifiable `main` entry point as
required by the particular runtime selected. These limitations can be
relaxed by using [configuration](#Configuring).

Subdirectories can be present under an action directory (e.g.
`node_modules`). These will be zipped up with everything else.

You can optionally limit the files to be zipped in one of two ways. A
file called `.include` can list exactly the items to be included and
anything else in the action directory will be excluded. Wildcards are
not permitted in this file but entries can denote directories as well as
files. The `.include` file can also be used for linking, as described
[below](#Linking).

Alternatively, you can have a file called `.ignore` stating which files
and directories *not* to include. The `.ignore` file follows the same
rules as `.gitignore` and should have the same effect. It is not
necessary to list `.ignore` inside itself (it is automatically ignored,
as are certain build-related files). You cannot have both `.include` and
`.ignore`.

No actual zipping occurs if:

   - the directory representing the action has only a single file in it, or,
   - only a single file is listed in .include, or
   - only a single file is left after applying the rules in .ignore

The action is named for the directory but includes only the single file (and takes its runtime kind from the file's suffix).

### <span id="Linking"></span>"Linking" action source from elsewhere in the filesystem

It is possible for the `.include` file to contain entries that denote
files or directories outside the action directory. That is, entries can
be absolute paths or relative paths containing '`..`' (relative to the
action directory).  These paths can terminate inside or outside the project, but
you might want to use caution in terminating them outside the project because it makes
it harder to relocate the project as a whole.  Recall that there can be arbitrary directories
in the root directory of the project, which becomes a good place to put "out of line" material.

Entries in `.include` are interpreted differently if they are absolute
or contain '`..`': the resulting entries in the zip file will start with
the last segment of the listed path. That is, if you have
`../../../actionSrc/node_modules`, the contents of that directory will
be zipped, but files inside the directory will have the form (e.g.) `node_modules/<path>`.
Similarly, the file `../../../actionSrc/helpers.js` becomes just
`helpers.js`.

-----

## <span id="Incremental"></span>Deploying Incrementally

Consider the previous example whose output was

```
Result of deploying project '.../example1'
  to namespace '...'
  on host 'https://...nimbella.io'
Deployed actions:
  - admin/adduser
  - sampleJavaScript
  - samplePython
  - welcome
  - demo/hello
  - test/work0
  - test/work30
```

Now let's suppose that you've changed `demo/hello` and `welcome` but not the others.   You aren't ready to do a production deployment or submit for testing, you just want to deploy the actual changes so you can continue developing.  You do this using the `--incremental` flag.

```
> nim project deploy example1 --incremental

Result of deploying project '.../example1'
  to namespace '...'
  on host 'https://...nimbella.io'
Deployed actions:
  - welcome
  - demo/hello
Skipped 5 unchanged actions
```

The `--incremental` option skips the uploads of actions whose digests have not changed.  Those digests are computed over the action's _contents_ and also its _metadata_ (thus, when you change properties of an action using [configuration](#Configuring), the change will be detected).  The `--incremental` option also skips the re-zipping of large multi-file actions whose included contents are older than the last zip.

As will be seen, the `--incremental` option also applies to [static web content](#AddingWeb).

Unless [build steps](#Build) are added, the incremental option will be accurate in determining what has changed.  Once you add build steps, some heuristics come into play as discussed [in a later section](#BuildIncremental).

### <span id="Watch"></span>Project watching

A good way to exploit the `--incremental` option when developing is to use `nim project watch`.

```
 > nim project watch example1
/Users/joshuaauerbach/nimbella> nim project watch example1
Watching example1
...
Deploying 'example1' due to change in 'project.yml'

Result of deploying project '/Users/joshuaauerbach/nimbella/example1'
  on host 'https://apijosh.nimbella.io'
Skipped 7 unchanged actions
Deployment complete.  Resuming watch.
```

The ellipsis in the example isn't part of the transcript, it represents a passage of time during which the `project.yml` of the project was changed in a way that did not effect the semantics of the action `demo/hello` (if it had, `demo/hello` would have been redeployed).  The `project watch` command accepts a list of projects and most of the flags that `project deploy` accepts (an exception is `--incremental`, which is assumed).  The command will run until interrupted (typically, one would devote a terminal window to it while working elsewhere, e.g., in your favorite IDE).

-----

## <span id="Configuring"></span>Adding Project Configuration

In the previous section we already mentioned limitations on what can be
done in a 'no-configuration' project. These limitations can often be
overcome by providing a configuration file called `project.yml` in
the project's root directory. This is coded in YAML.

The structure of the information in the config file should follow the
structure of the project itself. That is

```
globalStuff: ...
packages:
  - name: pkg1
    pkg1modifier1: ...
    pkg1modifier2: ...
    actions:
      - name: action1
        action1modifier1: ...
        action1modifier2: ...
  - name: pkg2
...

```

The project configuration is merged with what is inferred from file and
directory names, so it is only necessary to put information in the
configuration that cannot be inferred from file or directory names or
for which the defaults aren't what you want. Let's suppose that in
`example1` of the previous section we did *not* want `hello` to be a web
action and its main entry point could not be determined directly from
the code. We would have specified the following in the configuration
file.

```
packages:
  - name: demo
    actions:
      - name: hello
        web: false
        main: myMain
        limits:
          timeout: 10000

```

The action modifiers that can go in the configuration are as follows.

  - **web**, which may be `true`, `false` or `raw`. The default is
    `true`.
  - **runtime**, giving the runtime to use for the action. It should be
    in the form `"language:version"`, e.g. `"python:3"` or
    `"language:default"`, e.g. `"go:default"`. Because of the colon, the
    string should be quoted.
  - **main**, giving the main entry point for the action
  - **binary**, which may be `true` or `false`. This indicates the need for
    'base64' encoding when transmitting the action for deployment.
    Normally this is inferred from the file suffix
  - **webSecure**, which may be `true`, `false`, or a string containing the secret to use.
  - **annotations**, a nested map providing annotations to place on the
    action (see example below).
  - **parameters**, a nested map providing parameters that should be
    bound to the action and passed on each invocation
  - **clean**, which may be `true` or `false`, indicating whether you want any previous action with the same name to be removed before deploying a new one.  The default is `false`.
  - **limits**, a nested map in which you can set limits for the `timeout` (in milliseconds), `memory` (in megabytes) and `logs` (the number thereof).  All three of these must be numbers.  They must be within the range permitted by the Nimbella cloud.  Those not specified assume the defaults as defined by the Nimbella cloud.

The `web` modifier has the same semantics as it has on `nim action create` or `wsk action create`, except for the default.
The value 'yes' or 'true' produces a normal web action.  The value 'no' or 'false' produces an action that is not a web action.
The value 'raw' produces a raw HTTP web action.  The default is 'true' if not specified.   These behaviors are actually accomplished
via annotations with reserved meanings that are merged with annotations provided by you.

The 'webSecure' modifier has the same semantics as `--web-secure` has on `wsk action create` (`nim action create` does not offer a similar flag).  It generates the `require-whisk-auth` annotation according to whether you specify `false` (the default), a string value (the secret to use) or `true` (`nim` generates the secret for you).

```
packages:
  - name: demo
    actions:
      - name: hello
        annotations:
          final: true
          sampleAction: true
        parameters:
          language: English

```

The keys and values of parameters and annotations are up to you, so the
details are unimportant. The important thing is that both clauses are
"nested maps" in YAML terms and can have as many keys and values as
needed.

The `clean` modifier requires some explanation.  The deployer installs actions using the `update` verb, meaning that there is some history maintained in the installed action.  The version number will be incremented.  Parameters and annotations from a previous incarnation will be retained unless changed.  The code is always installed anew, however.  The `clean` flag guarantees that the action is built only from the information in the project by erasing any old copy of the action before deploying the new one.

The package modifiers that can go in the configuration are as follows.

  - **shared**, which may be `false` (default) or `true`. It indicates
    that the contents of the package are accessible to other authorized
    users
  - **annotations**, a nested map providing annotations to place on the
    package
  - **parameters**, a nested map providing parameters that should be
    bound to all the actions of the package and passed on each
    invocation
  - **clean**, which may be `true` or `false`, indicating whether you want any previous package with the same name (and all of its contained actions) to be removed before deploying a new one.  The default is `false`.

Note that `clean` at package level is _not_ the same as specifying `clean` on each action of the package.   At package level, the `clean` flag will remove all actions from the package before deploying, even ones that are not being deployed by the present project and will remove package parameters and annotations.  The `clean` flag at package level is only appropriate when you want the project to "own" a particular package outright.

There are also some useful global members of the configuration.

  - **targetNamespace** selects the namespace to which the project will be deployed.  It should be unnecessary unless you have multiple namespaces (discussed under [Managing Multiple Namespaces](#MultiNS)).
  - **cleanNamespace**, which may be `true` or `false`, defaulting to `false`.  It causes the entire namespace to be cleared of content (actions, package, and web content) prior to deployment.  This should be set to true only if you intend the project to have total ownership of the namespace.
  - **parameters**, a nested map providing parameters to place on _every_ package in the project.  This generalizes the feature (already in OpenWhisk) by which parameters on packages are distributed to the contained actions.  Placing parameters at top level causes them to be inherited (indirectly) by every action in the project.

The `cleanNamespace` global flag and the `clean` flags on actions and packages are ignored when `--incremental` is specified.

Two additional configuration members (`bucket` and `actionWrapPackage`) are documented in the [web content](#AddingWeb) chapter.

### <span id="SymbolicVars"></span>Symbolic Variables

The configuration can contain symbolic variables of the form `${SYMBOL}`
where `SYMBOL` is chosen by you. The substitutions for these variables are taken from the process environment or (optionally) from an "environment file".

The environment file will typically take the form of a "properties file" (key value pairs as in the following example).

```
USERID=josh
PASSWORD=notmyactualpassword
```

The environment file can also be JSON, as long as it contains a single object to be interpreted as a dictionary.

You can specify the environment file explicitly on the command line.

```
nim project deploy myProject --env test.env
```

If there is no `--env` option on the command line, but there is a file called `.env` located in the root of the project it will be used as the environment file.

Substitution is performed as follows

- If the symbol matches the name of an environment variable, the value of that environment variable is substituted and the environment file (if any) is ignored
- Otherwise, if there is an environment file and the symbol matches a key in it, the value paired with that key is substituted.
- Otherwise, the symbol is undefined, resulting in an error indication from `nim`.

### <span id="FileSubst"></span>File Substitution

The configuration can also "inline" the contents of certain files, in certain places in the configuration.  There are constraints on how this can be used as explained below.  Where it is legal, you request file inclusion by using the `<` modifier in what otherwise looks like a symbolic variable, e.g. `${<.extraConfig}`.   In this case, you can provide any valid file system path (absolute or relative) providing it denotes a file.  Files are relative to the project directory.

File substitution can only be used in places where the configuration would expect a "sub-dictionary" (a closed grouping of key value pairs under a specific heading like `parameters`, `annotations`, or `bucket`).  By "closed" we mean that you can do the following.

```
parameters: ${<.parameters}
peerOfParameters:
```

However, you can't do the following.

```
parameters: ${<.parameters}
  anotherParameter: value
```

The file to be inlined must either contain JSON or be in the form of a "properties" file (key value pairs).  In other words, it takes the same form as the "environment file" used in symbol substitution, but it need not be the same file (on the other hand, it _may_ be the same file, if you find that convenient).  If it is in the form of a properties file, it will be converted into a "shallow" dictionary (no nested sub-dictionaries) for the purpose of inclusion.  With JSON you can escape this restriction and have nested structure.  Note that the file is _not_ interpreted as YAML.

Warning: all inclusions are processed _before_ the resulting YAML is parsed.  For this reason, errors can be obscure when you violate the restrictions.

Typical use cases would be to set parameters or annotations on an action or package or set the top-level `parameters`.

```
parameters: ${<.parameters}
annotations: ${<.annotations}
```

-----

## <span id="AddingWeb"></span>Adding static web content

You add static web content to a project by adding a directory called
`web` which is a peer of the directory called `packages`. This directory
should contain files whose suffixes imply well-known mime types for web
content, such as `.html`, `.css`, `.js` (etc). Note that JavaScript
files in static web content are *not* actions but are scripts intended
to run in the browser.

The `web` directory can have subdirectories and can be built by web-site
builders or other tools.

Like an action directory, the `web` directory may contain `.include` or
`.ignore` to control what is actually considered web content (as opposed
to build support or intermediate results). The web directory also
supports integrated [building](#Building), just like an action
directory.

Let's first look at a project with modest web content, populated by hand.
The actions of the project are not shown, for simplicity.

```
example3/web/chatroom.html
example3/web/chatroom.css
example3/web/runner.js
example3/web/favicon.ico
```

Deploying the project, we see the following.

```
 > nim project deploy example3

Result of deploying project '.../example3'
  to namespace '...'
  on host 'https://apigcp.nimbella.io'
Deployed 4 web content items to
  https://<ns>-apigcp.nimbella.io
Deployed actions:
  ...
```

As the output shows, the contents of `web` were deployed to the web,
with URLs within your namespace's unique DNS domain `<ns>-apigcp.nimbella.io`.  The token `<ns>` will be
replaced by the name of your namespace.  The remaining portion of the domain name may differ from the typical `apigcp.nimbella.io`
depending on your API host within the Nimbella cloud. To access the content, either
`http` or `https` may be used. For `https`, the SSL certificate will be
that of Nimbella Corp.

When web content is deployed, entries are made in `.nimbella/versions.json` just as for actions and packages.  Since web resources do not have version numbers, only the digests are stored.  But, those digests are used, just they are for actions, to bypass the deployment of web resources that have not changed since the last deployment when the `--incremental` flag is specified.

When `https://<ns>-apigcp.nimbella.io` is used as a URL with no additional path component, a path of `/index.html` is
assumed (which would not be convenient for `example3`).  You can change this by adding a `bucket` member (top
level) to `project.yml`. In a nested map under `bucket` you can
specify several pieces of information. All of the entries in the
following example are optional.

```
bucket:
  prefixPath: "chatroom"
  clean: true
  mainPageSuffix: chatroom.html
  notFoundPage: "error.html"
  strip: 1
```

The prefix path is prepended to every URL path as resources are
uploaded. For example, given the examples above, the resource
`runner.js` would be deployed to
`https://<ns>-apigcp.nimbella.io/chatroom/runner.js`. If
your web content does not require being placed at the root of the URL path
space, this can allow web content from different projects to share a namespace and a hostname.  Ensuring that namespace sharing works for your particular content is beyond the responsibility of the deployer (it does not rewrite URLs internal to your content).

Thw `clean` flag indicates whether old content should be deleted prior to deploying the new content.  The default is `false`.  The content to be deleted  is everything under the `prefixPath`, if specified, or all previously deployed web content, otherwise.  Note also that a top-level `cleanNamespace: true` designation will clear web content along with actions.

The `mainPageSuffix` is called a "suffix" because it affects what
happens when any URL is used that denotes a directory rather than a
file. This includes (but is not limited to) the case where there is no
path segment in the URL at all. If you do not specify a `mainPageSuffix` the default is `index.html`. The deployer does not generate `index.html` nor any other file you name here:  you must provide the file as part of  the web content.

The `notFoundPage` nominates a web page to be used for a URL that does
not match any content. The page designated here will be returned with
every 404 ("not found") error. If you do not specify a `notFoundPage`, the default is `404.html`.  Nimbella places its own `404.html` at the root of every namespace and will preserve a file by that name when deleting web content from the namespace.  You may overwrite the provided `404.html` or leave it there and use a different name for your "not found" page (the latter approach allows you to revert to the Nimbella-provided one by removing the `notFoundPage` directive).

Both the `mainPageSuffix` and the `notFoundPage` are global to the
namespace, so, if you do deploy multiple web folders into the same
namespace using separate projects, either use the same values in all
such projects or only specify them in one of the projects. It should be
possible to obtain more than one namespace from Nimbella to deal with
any conflicts that are otherwise hard to resolve.

The `strip` option is, in a sense, the opposite of `prefixPath`, in that it removes path segments rather than adding them.  You can have both `strip`
and `prefixPath`, to first remove existing segments, then add new ones.  The `strip` option is mostly useful when you use a tool to generate web content. Chances are the tool will want to put its
output in a specific directory.  Consider an example with the following directory structure under `web`.

```
example4/web/.include
example4/web/public
example4/web/build
example4/web/src
```

In `web` itself, in addition to `.include`, are some other files related to building (not shown).  The `public` and `src` directories, between them, contain the source of a `react` web application.  The `build` directory is generated by the `react` build and contains the entire content that you want to deploy.  The `.include` file has simply

```
build
```

In `project.yml` you have

```
bucket:
  strip: 1
```

The deployment should go like the following.

```
 > nim project deploy chat
Running './build.sh in chat/web

Result of deploying project '.../chat'
  to namespace 'chatdemo'
  on host 'https://apigcp.nimbella.io'
Deployed 24 web content items to
  https://chatdemo-apigcp.nimbella.io
Deployed actions:
  - chatadmin/create
  ...
  - chatroom/postMessage
```

### <span id="WebLimitations"></span>Limitations, Requirements

We currently support the preferred form of deployment, as shown above,
only when your API host is
in the Google Cloud Platform (as will be the case of initial customeres). We intend to provide the service
transparently across all of our supported clouds in the future.

For a web deployment to work correctly, the namespace entry in the credential store must
include `storage` (look in the 'Storage' column of `nim auth list`).
At present, the first namespace created for each user does include this member, but it is
possible to create namespaces without it.

### <span id="ActionWrapping"></span>The "Action Wrapping" Alternative

If you are familiar with OpenWhisk [web
actions](https://github.com/openwhisk/openwhisk/blob/master/docs/webactions.md)
you may know the trick of converting a web page to a string constant
that is then returned by a web action. The result appears to the user as
if static content was served. The deployer will automate this idiom for
you, as long as your `web` directory has no subdirectories. To employ
this option, place a top level member `actionWrapPackage` in your
`project.yml` and do *not* also provide a `bucket` member. For
example, to place all of your web content in the package called `demo`:

```
 actionWrapPackage: demo

```

The package you designate may also contain actions, or not, as you wish.

Of course, the performance characteristics of this solution are not
ideal for static content. However, your static content is simple enough,
meets the "no subdirectories" restriction, and is incidental to a
project consisting mostly of actions, action wrapping may be adequate.
In terms of the current limitations mentioned in the previous section,
action wrapping is available on all Nimbella-supported clouds and does not
require a namespace whose credentials include `storage` member.

-----

## <span id="Building"></span>Incorporating build steps for actions and web content

The web directory, and also every directory that represents an action,
can be built automatically as part of deployment. You can trigger this
behavior in one of three ways.

1.  By placing a file called `build.sh` (for mac or Linux), or `build.cmd` (for windows), or both, in the directory. This file
    should contain a script to execute with the directory as current directory.  If both forms are provided, only the one
    appropriate for the current operating system will be used.  If only one is provided, the deployer will run on systems for which that kind of script is appropriate and indicate an error on other systems.
2.  By placing a file called `.build` in the directory. The rules for
    this option are explained under [out-of-line builds](#OutOfLineBuild) below.
3.  By placing a `package.json` file in the directory. The presence of
    this file causes `npm install --production` (or `yarn install --production`) to be executed with the directory as current directory.
     - `npm` is used by default.  To substitute `yarn`, use the flag `--yarn` on the `nim project deploy` command.

These triggers are examined in the above order, and, if one is found,
the others are not considered by the deployer (of course, a script in
`build[.sh|.cmd]` can always do its own `npm install` or `yarn install`).

Note that `build.sh`, `build.cmd`, and `.build` (but not `package.json`) are automatically ignored and do not have to be listed
in `.ignore`.

Building precedes the determination of what files to upload (web) or zip
into the action (action directories). This has two implications.

- It is possible (though not required) for the script to generate the `.include` or `.ignore` file that refines this process.
- If the build is designed to produce a `.zip` file directly, you must _also_ ensure that there are no other files that will be interpreted as part of the action (otherwise the deployer will do its own zipping).  The easiest way to ensure that there is only one file is to use a one-line `.include`.

### <span id="BuildErrors"></span>Errors in Builds

The deployer decides whether a build has failed based on examining the return code from a subprocess running the build.  Thus, it is good practice to ensure that a build will set a non-zero return code on failure.   When a build returns a zero, the deployer does not display its output.  If it returns non-zero, all of its output (both on `stdout` and on `stderr`) are displayed.

If you suspect a build is not doing what you expect but there is no visible error, try rerunning `nim project deploy` with the `--verbose-build` flag.  This causes all of the output of the build to display on the console, regardless of apparent success.  This will often reveal errors in the build that are being swallowed because the build is returning zero despite the errors.

We've tried using other criteria, such as the presence of output on `stderr` but that does not work well in practice.  Many utilities (most notably `npm`) write some of their output to `stderr` routinely.

### <span id="OutOfLineBuild"></span>Out-of-line builds and shared builds

There are three possibilities when using the `.build` directive ("out of line" building).

1.  If `.build` contains a single line giving a path name of a file, that file
    is taken to be a script and is executed with the directory
    containing `.build` as the current directory.
    - Most script languages
    allow a script to determine the directory.
     in which it is running
    from its path name. The deployer always executes scripts via their
    full path name, so the script will have both its own directory and
    the web or action directory to work with.
2.  If `.build` contains a single line giving the path name of a
    directory, that directory is made current and building is performed
    there, based on the presence of `build[.sh|.cmd]` (higher priority) or
    `package.json`. Recursive use of `.build` is not supported.
3.  If the directory of the previous case contains a marker file called `.shared` (contents ignored), the deployer will ensure that the build in that directory is only run once.
     - This can allow multiple actions to share the same build even if there are many such actions and the build is time consuming to run.
     - This can be useful in scenarios in which actions share a lot of common content.
3.  If `.build` has more than one line, or is empty, or denotes a file
    or directory that does not exist, or denotes a directory not
    containing one of the recognized build directives, an error is
    indicated by the deployer.

Recall that it is possible to place arbitrary content in the root of project as long as it does not conflict with the reserved names `web`, `packages`, `.nimbella`, or `project.yml`.  So, directories containing out-of-line building support can be placed there.

### <span id="BuildIncremental"></span>The effect of `--incremental` on Builds

Using the `--incremental` option has an effect on whether or not builds are executed.

Each action that has a build step can be either in a _built_ or _unbuilt_ state.  Similarly, the `web` directory can be either _built_ or _unbuilt_.  If an action or web directory is _unbuilt_, the build is run as usual prior to determining if the content has changed.   If the directory is _built_, the incremental deployment proceeds directly to change determination without re-running the build.  The state is determined as follows.

- If the build is triggered by `package.json`, the directory is considered _built_ if and only if it contains a `package-lock.json` (or `yarn.lock`) and a `node_modules` both of which are newer than the `package.json`.  If both `package-lock.json` and `yarn.lock` are present, the newer of the two is used in this determination.
- If the build employs a script, then the directory is considered _built_ if and only if _the directory containing the script_ also contains a file called `.built` (for out-of-line builds, the directory containing the script is usually not the action directory).

In the script case, the convention of using a `.built` marker to suppress subsequent builds requires the script to set this marker when it executes.  It's a very coarse-grained heuristic, which we offer because (1) the deployer doesn't know the dependencies of the build and (2) we want to err in the direction of efficiency when doing incremental deploying.  You always have the remedy of running a full deploy.  But, note that the use of this convention is optional.  If the script does not create a `.built` marker, it will always run, which could be fine if the script does dependency analysis and rebuilds only what it needs to.

In the `package.json` case, what we do is also a heuristic and won't be perfectly accurate if the `package.json` actually contains scripts that run as part of the install step.  However, we believe it will work well in simple cases.  Again, you always have the fallback of running a full deploy.

### <span id="BuildExamples"></span>Examples of building (common use cases)

Let's start with a simple `node` dependency.

Project `example5` has a function in a single file but it has node/npm-style dependencies.  Here is a part of the project layout

```
example5/packages
example5/packages/demo
example5/packages/demo/qrfunc
example5/packages/demo/qrfunc/package.json
example5/packages/demo/qrfunc/qr.js
```
Let's deploy that.

```
> nim project deploy example5
Running 'npm install' in example5/packages/demo/qrfunc

Result of deploying project 'example5'
  to namespace '...'
  on host 'https://...nimbella.io'
Deployed actions:
  - demo/qrfunc
  ...
```

Yes.  That's all that was needed.  The presence of `package.json` triggered the `npm install`, after which the normal behavior for multi-file actions (autozipping) took over and created a zip file to upload that contained `qr.js`, `package.json` and the entire `node_modules`.

If you try this yourself bear in mind that the OpenWhisk runtime for `nodejs` requires either that `package.json` provide an accurate designation of the main file or else that the file be called `index.js`.

Now let's consider the case where there are many actions, each with unique content, but only one `node_modules`.

```
example6/build
example6/build/.shared
example6/build/package.json
example6/packages
example6/packages/default
example6/packages/default/test1
example6/packages/default/test1/.build
example6/packages/default/test1/index.js
example6/packages/default/test1/.include
example6/packages/default/test2
example6/packages/default/test2/.build
example6/packages/default/test2/index.js
example6/packages/default/test2/.include
```

The `package.json` in `build` specifies the common dependencies.  The `.shared` file is empty (it is just a marker).  Each `.build` directive looks like this.

```
../../../build
```
Each `.include` file looks like this.

```
../../../build/package.json
../../../build/node_modules
index.js
```

The regularity of this example shouldn't be taken to mean that the individual actions cannot have more than one source file (they can easily do so).  They do, however, need to share the same `package.json` if they want to use the common build.  Because of that, they also need to use the same main file name (`index.js` in this case).  If at any time you want some actions to have their own `package.json`, just add it and remove `.build`.  Those actions then have their own dependencies (and their own `npm install` or `yarn install`) but then they are not using the common one any more.  A project can have a mixture of actions that share builds and actions that don't.

Another way to use a common build is to use a shell script and put logic there that completely populates the actions and web content (all of which simply point to it).  It will execute exactly once, walk the directory structure of the project, and do whatever needs doing.

-----

## <span id="MultiNS"></span>Managing Multiple Namespaces

There are a number of reasons why it may be useful to have multiple namespaces.  A typical namespace is provisioned with two storage buckets (one for web content and one accessible to actions for use as a virtual file system), a `redis` instance, a DNS domain name for web content, and a set of OpenWhisk resources.  While multiple applications can share a namespace, there are also good reasons to isolate them.

To obtain additional namespaces at this point in time it is necessary to [contact Nimbella Support](https://nimbella.com/contact).  Identify yourself as an existing developer and provide the email you used for signing up initially.

The way you are granted access to an additional namespace is identical to the way you activated your initial one.  You receive a token via email and then you use

```
nim auth login  <long hexidecimal string provided by Nimbella>
```

This will add the additional namespace to your credential store and you will now be able to switch between namespaces.  Initially, the newly added namespace is "current" (explained in more detail in the following).

The easiest way to manage multiple namespaces is to add the

```
targetNamespace: <namespace>
```

top level directive to the `project.yml` of each project and simply maintain the rule that each project is tied to a namespace.   More complex development scenarios (where a single project may deploy to different namespaces, e.g. a test namespace and a production namespace) can be managed by using the `--target` directive of `nim project deploy`.

```
nim project deploy <projectPath>... --target <namespace>
```

If you have a `targetNamespace` in `project.yml` and also use the `--target` directive, the latter takes precedence.  A value specified with `--target` is remembered, and will apply to subsequent deployments that do not use either `targetNamespace` or `--target` to specify a new target.

It is also possible to change the remembered target namespace without deploying anything.

```
nim auth switch <namespace>
```

If you use the `wsk` command in conjunction with `nim`, note that its configuration file (`~/.wskprops`) is updated on every switch of the target namespace via `nim auth`.

If you need the deployment of a project to have different characteristics depending on the target namespace (e.g. parameters that might differ between test and production), you might prefer to use [symbolic substitution](#SymbolicVars), e.g. `targetNamespace: ${NAMESPACE}`, and provide the value of `NAMESPACE` in an environment file along with other substitutions.

Usually, a Nimbella developer has just one API host and all namespaces use the same one.  But, multiple API hosts can be accommodated as well.

1. If all of your namespaces have unique names, even though some are on different API hosts, the API host is automatically switched when you switch the namespace.
2. If you happen to have identically named namespaces on different API hosts, then you must use the `--apihost` flag to disambiguate as in the following.

```
nim auth switch <namespace> --apihost <API host>
nim project deploy <projectPath>... --target <namespace> --apihost <API host>
```
