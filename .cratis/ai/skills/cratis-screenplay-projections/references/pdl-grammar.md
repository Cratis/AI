# PDL — complete grammar and diagnostics

Verified against `Documentation/screenplay/projections/grammar.md` and
`Source/DotNET/Screenplay/Parsing/ProjectionParser.cs` at commit `122eee8`.

Two places below are deliberately **looser than the published EBNF**, because the
parser accepts more than that EBNF describes and both forms were confirmed by
compiling them:

- `EveryBlock` accepts a bare `automap` as well as `no automap`. The published
  grammar lists only `no automap`, but `from-every.md` shows `automap` in an
  example and `ParseMappingBlock` handles both.
- The braces on a composite key are **optional**. The published grammar writes
  them as required; a composite key with and without them both compile clean.

## Grammar

```ebnf
Projection      = "projection", Ident, [ "=>", TypeRef ], NL,
                  [ INDENT, { ProjDirective | Block }, DEDENT ] ;

ProjDirective   = "no", "automap", NL
                | "sequence", Ident, NL
                | "file", FilePath, NL
                | KeyDecl
                | CompositeKeyDecl ;

Block           = EveryBlock | FromAllBlock | FromEventBlock | JoinBlock
                | ChildrenBlock | NestedBlock | RemoveWithBlock | RemoveWithJoinBlock ;

EveryBlock      = "every", NL, INDENT,
                    [ "automap" | "no", "automap", NL ], { MappingLine },
                    [ "exclude", "children", NL ], DEDENT ;

FromAllBlock    = "all", NL,
                  [ INDENT, [ "automap" | "no", "automap", NL ], { MappingLine }, DEDENT ] ;

FromEventBlock  = "from", EventSpec, { ",", EventSpec }, NL,
                  [ INDENT, [ ParentDecl ], { MappingLine | KeyDecl | CompositeKeyDecl }, DEDENT ] ;
EventSpec       = TypeRef, [ "key", Expr ] ;

JoinBlock       = "join", Ident, "on", Ident, NL, INDENT, { WithEventBlock }, DEDENT ;
WithEventBlock  = "with", TypeRef, NL,
                  [ INDENT, [ "automap" | "no", "automap", NL ], { MappingLine }, DEDENT ] ;

ChildrenBlock   = "children", Ident, "identified", "by", Expr, NL,
                  INDENT, [ "no", "automap", NL ], { ChildBlock }, DEDENT ;
ChildBlock      = ChildEveryBlock | FromEventBlock | JoinBlock | RemoveWithBlock
                | RemoveWithJoinBlock | ChildrenBlock | NestedBlock | ClearWithBlock ;
ChildEveryBlock = "every", NL, INDENT, [ "no", "automap", NL ], { MappingLine }, DEDENT ;

NestedBlock     = "nested", Ident, NL,
                  INDENT, [ "automap" | "no", "automap", NL ],
                  { ProjDirective | Block | NestedBlock | ClearWithBlock }, DEDENT ;
ClearWithBlock  = "clear", "with", TypeRef, NL ;

RemoveWithBlock = "remove", "with", TypeRef, [ "key", Expr ], NL,
                  [ INDENT, [ ParentDecl ], DEDENT ] ;
RemoveWithJoinBlock = "remove", "via", "join", "on", TypeRef, [ "key", Expr ], NL ;

KeyDecl         = "key", Expr, NL ;
CompositeKeyDecl= "key", TypeRef, [ "{" ], NL,
                  INDENT, KeyPart, { NL, KeyPart }, DEDENT, [ "}", NL ] ;
KeyPart         = Ident, "=", Expr ;

MappingLine     = Assignment | ClearLine | IncLine | DecLine | CountLine | AddLine | SubLine ;
Assignment      = Ident, "=", Expr, NL ;
ClearLine       = "clear",     Path, NL ;
IncLine         = "increment", Ident, NL ;
DecLine         = "decrement", Ident, NL ;
CountLine       = "count",     Ident, NL ;
AddLine         = "add",       Ident, "by", Expr, NL ;
SubLine         = "subtract",  Ident, "by", Expr, NL ;

Expr            = Template | Literal | DollarExpr | Path ;
DollarExpr      = "$eventSourceId" | "$eventContext", ".", Ident | "$causedBy", ".", Ident ;
Template        = "`", { TemplateChar | "${", Expr, "}" }, "`" ;
Literal         = BoolLiteral | StringLiteral | NumberLiteral | NullLiteral ;
LiteralKeyword  = "literal", " ", Literal ;   (* parsed at the Expr level *)
```

## Parser regexes

| Construct | Regex |
| --- | --- |
| Projection header | `^projection\s+(@?[\w.]+)\s*(?:=>\s*([\w.]+))?$` |
| Event spec | `^(@?[\w.]+)(?:\s+key\s+(.+))?$` |
| Join | `^join\s+(@?[\w.]+)\s+on\s+(@?[\w.]+)$` |
| With | `^with\s+(@?[\w.]+)$` |
| Children | `^children\s+(@?[\w.]+)\s+identified\s+by\s+(.+)$` |
| Nested | `^nested\s+(@?[\w.]+)$` |
| Remove with | `^remove\s+with\s+(@?[\w.]+)(?:\s+key\s+(.+))?$` |
| Remove via join | `^remove\s+via\s+join\s+on\s+(@?[\w.]+)(?:\s+key\s+(.+))?$` |
| Counters | `^(increment\|decrement\|count\|clear)\s+(@?[$\w.]+)$` |
| Arithmetic | `^(add\|subtract)\s+(@?[$\w.]+)\s+by\s+(.+)$` |
| Assignment | `^(@?[$\w.@]+)\s*=(?!=\|>)\s*(.+)$` |

## Diagnostics

| Code | Meaning |
| --- | --- |
| `PLAY0054` | A projection document's top-level line does not open a `projection` |
| `PLAY0055` | A projection document declares no projection |
| `PLAY0056` | A `projection` line is not `projection <Name> [=> <ReadModel>]` |
| `PLAY0057` | A projection declares no directives, so it builds nothing |
| `PLAY0058` | A projection body line opens with an unknown word |
| `PLAY0059` | A projection declares more than one key |
| `PLAY0060` | A `from` block declares more than one key |
| `PLAY0061` | A `from` line names no event |
| `PLAY0062` | An event reference is not a readable name |
| `PLAY0063` | A `join` line is not `join <property> on <key>` |
| `PLAY0064` | A join block holds a line that is not `with <EventType>` |
| `PLAY0065` | A `children` line is malformed |
| `PLAY0066` | A `nested` line is not `nested <property>` |
| `PLAY0067` | A nested block reads from no event, so nothing ever fills it |
| `PLAY0068` | A `remove` line is neither `remove with` nor `remove via join on` |
| `PLAY0069` | A remove block holds a line other than `parent` |
| `PLAY0070` | A `clear` line is not `clear with <EventType>` |
| `PLAY0071` | `clear with` is written where there is nothing to clear |
| `PLAY0072` | A composite key part is not `<property> = <expression>` |
| `PLAY0073` | A composite key part is a template expression, which a key cannot be |
| `PLAY0074` | A composite key declares no parts |
| `PLAY0075` | A projection mapping line is unreadable |
| `PLAY0186` | A `readmodel` line is not `readmodel <Name>` |
| `PLAY0187` | A `reducer` line is not `reducer <Name> => <ReadModel>` |
| `PLAY0188` | A reducer body line is not `on <EventType>` |
| `PLAY0189` | A reducer declares no rules |
| `PLAY0190` | A reducer rule body opens with an unknown word |
| `PLAY0191` | A read model is built by more than one projection or reducer |
| `PLAY0192` | A read model is declared more than once |

## Worked examples

### Composite key with event context

```screenplay
projection LineItems => LineItemReadModel
  from LineItemAdded
    key LineItemKey
      OrderId        = orderId
      LineNumber     = lineNumber
      SequenceNumber = $eventContext.sequenceNumber
      CreatedBy      = $causedBy.subject
    Product = productName
```

### Global counter with a literal key

```screenplay
projection SiteStats => SiteStatsReadModel
  from UserLoggedIn key literal "site-stats"
    count TotalLogins
    lastLogin = $eventContext.occurred
```

Every `UserLoggedIn` updates the same instance, whatever its event source.

### System-wide audit with `all` alongside `from`

```screenplay
projection ActivityFeed => ActivityFeedModel
  all
    count totalSystemEvents
    lastActivity = $eventContext.occurred
  from UserRegistered
    recentUsers = name
```

`totalSystemEvents` counts **every** event in the system; `recentUsers` only fills
on `UserRegistered`.

### Children with a join and scoped removal

```screenplay
projection Group => GroupReadModel
  from GroupCreated
    Name = name
  children members identified by userId
    from UserAddedToGroup key userId
      parent groupId
      Role = role
    join User on UserId
      with UserCreated
        no automap
        UserName = name
    remove with UserRemovedFromGroup key userId
      parent groupId
```

### `every` that ignores child activity

```screenplay
projection Group => GroupReadModel
  every
    LastActivity = $eventContext.occurred
    exclude children
  from GroupCreated
    Name = name
  children members identified by userId
    from UserAdded
      Name = userName
```

Group-level events bump `LastActivity`; member events do not.

### Nested nullable object

```screenplay
projection Slice => SliceReadModel
  from SliceCreated
    Name = name
  nested command
    from CommandSetForSlice
      Name   = commandName
      Schema = schema
    from CommandRenamed
      Name = newName
    clear with CommandClearedForSlice
```

`command` is null until `CommandSetForSlice`, updated in place by
`CommandRenamed`, and set back to null by `CommandClearedForSlice`.

### Several projections in one slice

```screenplay
slice StateView CustomerPortalReport
  query GetPortalReport => PortalReportReadModel
    by customerId CustomerId
  projection PortalReport => PortalReportReadModel
    from PortalInvitationSent
      invitedAt = $eventContext.occurred
  projection RevokedPortalToken => RevokedPortalTokenReadModel
    from PortalTokenRevoked
      revokedAt = $eventContext.occurred
```

Two read models, one behavior. Splitting them across two slices would say the
system has two behaviors where it has one.
