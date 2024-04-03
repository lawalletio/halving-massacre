# Create Ticket

This endpoint is used for creating a ticket on a currently open game (a game that is either on `SETUP` or `INITIAL`)

```sh
curl --request POST \
  --url http://https/<apiendpoint>/games/<gameId>/tickets \
  --header 'Content-Type: application/json' \
  --data '{
  "walias": "<username>@<domain>"
}'
```

## Method, URL and params

`POST https://<apidomain>/games/<gameId>/tickets`

### Path params

- `gameId`: id of the game where the ticket must be created, this is the nostr event id of the setup event

## Request body

```json
{
  "walias": "<username>@<domain>"
}
```

The body must be a json containing the walias of the user that will enter with the created ticket

## Response body

### Success

```json
{
  "pr": "<bolt11 invoice>",
  "routes": [],
  "eTag": "<string that will be published ad zapReceipt eTag>"
}
```

The success response will be a valid lud06 response with the invoice in the `pr` key

### Error

```json
{
  "message": "<Error message>"
}
```

If any validation fails the response will be have a 4XX code, if the invoice generation itself failed or we encountered any unexpected error the code will be 5XX, in any case the body will contain a message.
