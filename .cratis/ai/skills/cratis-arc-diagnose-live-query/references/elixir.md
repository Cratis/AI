# Distinguish opening from later delivery

Check the transport first: WebSocket carries subscription messages on the socket; SSE opens a stream then uses control POSTs. Authenticate those POSTs and verify the selected tenant on the subscribe request; an open SSE connection alone has not enrolled a query. Track `connectionId`, `queryId` and `revision` so a delayed subscribe cannot undo a later unsubscribe. Do not assume a `.cratis-identity` cookie or cross-node replay memory.

After the first result, write a matching record under the same tenant. Check the `@observe` watch list or notification topic, then the rerun and its returned value. Node-local topics do not propagate across replicas. Recheck with the writer and subscriber on different nodes before relying on local notifications.
