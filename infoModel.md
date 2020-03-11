## The Nimbella Information Model

The Nimbella Information Model is intended to be a superset of the OW information model.  It has been implicit up to now and all I am doing here is making it explicit.  It can certainly be evolved, but deep changes to it will be expensive.

This is currently for internal discussion and not intended as a customer document. However, being clearer about the model with customers (once we are in agreement that it is an accurate description of current reality) may be a good idea.

### Terminology

The entities of the model consist of containers, resources, and projects

- Containers
    - Namespaces
    - Packages
- Resources
    - Web store
    - Object data store
    - Key-value store
    - OW resources that may be contained in packages (e.g. actions, feeds)
    - other OW resources
- Projects

I am using "container" in an ownership sense.  To qualify as a container, the contained resources cannot also appear in another container.

### Relationship to the `nim` CLI

There is a subtree of the `nim` CLI for each entity in the model.  Commands must be assigned to subtrees based on a clear understanding of which kind of entity they operate on.

### Namespaces

A namespace is the container for entities that share common authentication and authorization.

- all resources are nested, directly or indirectly, in namespaces
- the following are always directly nested in namespaces and cannot be nested in packages
    - packages (1 or more)
    - web store (at most 1)
    - object data store (at most 1)
    - key-value store (at most 1)
- OW resources may be nested in packages or directly in namespaces, depending on the kind of resource.  Some kinds (e.g. actions) can do either.

### Projects

Projects are not containers in the model

- although they contain material organized as web content and actions, the material is contained in its undeployed state.  The project only contains _references_ to the deployed forms.
- the project is unknown to the backend
- the project doesn't have an exclusive right to deploy to the actual resources; they can be modified by other projects or no project at all

Project are not contained by namespaces

- although a project can only deploy to one namespace _at a time_, nothing prevents a project from deploying serially to any namespace currently chosen by the developer
- while a `targetNamespace` may be specified in `project.yml`, it is optional and overrideable

On the other hand, developers and teams may (and are encouraged to) adopt invariants that work for them concerning the relationship between projects and the resources they deploy

- a _one-to-one_ relationship between projects and namespaces has the advantage of simplicity
    - Under issue #12, teams will have a way of enforcing this and extending it to a _one-to-two_ relationship (in which there is a development namespace and testing namespace for selected projects).
    - This will remain optional
- a _clean partitioning_ of the resources of a namespace between projects is also a reasonable possibility but
     - it is difficult to partition the web store because some of its properties are global
     - teams are on their own in deciding on how to partition storage resources, divide up packages, or split packages between projects
     - because packages can own only certain OW resources and not storage they will not always correspond to the desired boundaries

### Cross-ties

Notwithstanding all of the previous, we do maintain some cross-ties between projects and the resources in namespaces.

- We record a _deployer annotation_ in packages and actions as they are deployed
- We record the last deployment to each namespace/apihost pair locally
    - note this is the latest deployment only: no history
    - note also that this is information _about_ the deployment and not the contents of resources.  The record cannot be used to restore resources to their state prior to the deployment
- We support a `cleanNamespace` flag and `clean` flags in `package`, `action`, and `bucket` clauses.  These are things that _only make sense_ if the developer or team is assuming an implicit ownership of the resources in question by the project.

The cross-ties are too weak to be the basis of a stronger ownership relation.  They are only respected by the `nim project` subtree.   The `nim action` or `nim package` subtrees (etc) can step on the deployer annotation in deployed resources and will ignore locally recorded deployment information.
