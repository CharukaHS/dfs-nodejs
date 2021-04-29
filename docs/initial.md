# Fileshard

## Tasks of components

### Service registry (`localhost:3000`)
- Keep a ledger of available nodes
- Update ledger based on `/healthcheck` webhook
- Check health of nodes for every n seconds
- Handle inter-communication between nodes

### DFS Nodes (`localhost:4xxx`)
- Transfered into master or slave node based on service-registry response (bully algorithm)

#### Master nodes
- Split files into chunks and chunk_id
- Contain a ledger
```ts
{
  "filename": string,
  "metadata": {},
  "chunks": {
    "chunk_id": string,
    "locations": node_id[]
  }[]
}
```

#### Slave nodes
- Save chunk data along with chunk id
- Pass command to other nodes in redundancy process
- Provide chunks when client request them with chunk_id
```ts
{
  "chunk_id": string,
  "data": data
}
```
- Generate MD5 for chunks

### Learning node (`localhost:3001`)
- Generate and store checksum (MD5) for each chunk
- Validate checksum when file retreiveing

## Starting process

1. Start service registry
2. Spawn multiple DFS-nodes
  > spawning manually in CLI, port number (4000 <= x < 5000) is node_id
  - Each node has a unique id, ~~based on time the node spawned~~
  - Send a post request to service-registry `localhost:3000/registration` (third party registration pattern)
  - When a node registrated in service-registry, information about other nodes are being delivered to nodes
  - Determine a master node by bully algorithm (**NEED HELP ON THIS PART!**)
3. Spawn learner node
  - Signal service register when necessary

## When a file is writing to the system
1. Client POST to `localhost:3000/newfile`, service registry redirect it to master node.
2. Master node split file into chunks
  - **NEED HELP**: how to determine the dividing factor of file, assignment says divide into chunks based on no. of nodes which can result chunks larger than node's storage. IMO constant size is better but need your opinion.
  - Save chunk, file data in ledger
3. Master node command service-registry to pass data to learner node to create checksums.
4. Master node command service registry to pass data to slave nodes to save data, if redudant copies should exist, node must pass data to other required nodes

## When a file is reading from the system
1. Client GET to `localhost:3000/retrieve`, service registry redirect it to master node
2. Generate slave nodes to generate MD5
3. Send checksums to learner node and validate them
4. If checksum fails, retrieve the chunk from another node
5. Send slave node ips, check ids to client
6. Client retrieve chunks from slave nodes

## Points covering
- [x] Sidecar implementation  
Express app exposing some endpoints will be attached to the nodes. Still I need to confirm my method follows "sidecar architecture"
- [x] Usage of service registry
- [ ] Bully Algorithm  
The way bully algorithm applied here is the node with higher id is the master. But I've some doubts regarding the commands used in bully algorithm.  
  1. At start there is no master, which node calls the election?  More simply: First node register in service-registry and does it becomes the master immediately? and an election only conduct when the that first node crashed? Or we wait till all the nodes register with service registry then conduct the election?
  2. When a new node register in the service registry, do we have to announce it to every other node about the new node? Or all we need to do is just pass the details about other nodes to new node.
  3. If the master node fails, how to recover the ledger master had?
- [ ] Distributed algorithm  
  Still not clear how to use paxos for pre-veritifacation of checksums. I read the lecture notes you send and still the use case of paxos to validate checksums is in doubt. My plan was to implement a redis instance in learner node and save chunk_ids and checksums inside it.
- [x] Scalability
- [ ] Facult tolerance
  What does assignment expect from this point? Just implementation or more in-depth points like ACID databases etc.

---
CharukaHS  
charuka@protonmail.com  
077 885 9503