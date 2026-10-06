# Projection (PDL) example

Projection forms that compile warning-free, bind and run on both tools (`RejectingAnEmptyCode` passes in the reference runner): every, join, children, nested, clear with, remove with, increment/decrement, all + count, add/subtract by, set to, clear, no automap, literal mapping, variant group (no `=> RM`), concept rules not empty/max/length ==. Rejected by the binder: more than one every/all block on one level (PLAY0268); `$eventContext.occurred.Week` (PLAY0273, derived value). Not in this example because they block the whole execution plan in the reference runner (Screenplay v4.64.0): a `remove via join` on a projection's own (root) level (`UnsupportedProjectionBlock`; it binds, but on Chronicle v19.32.0 it creates no removal subscription, so `CustomerDeleted` would not remove an `OrderView`), and any event-context value other than the event source identity in a projection, such as `$eventContext.occurred` (`UnsupportedEventContext`). Quick reference: [cheat-sheet.md](cheat-sheet.md). The `every` block here maps a literal to show the form. Carry a timestamp on the event with `$context.occurred` in the producing command when a view must show it.

```screenplay
// PDL forms that bind executable on both tools.
concept OrderId : Uuid
concept CustomerId : Uuid
concept IssueId : Uuid
concept AccountId : Uuid
concept Code : String
  validate
    not empty  message "Required"
    max 10     message "Too long"
    length == 4
type OrderLine
  lineNumber Int
  sku        String
type Shipping
  carrier String optional
module Shop
  feature Orders
    slice StateChange PlaceOrder
      command PlaceOrder
        orderId    OrderId identifier
        customerId CustomerId
        total      Decimal
        produces OrderPlaced
          for orderId
          customerId = customerId
          total      = total
        produces LineAdded
          for orderId
          lineNumber = 1
          sku        = "A-1"
      event OrderPlaced
        customerId CustomerId
        total      Decimal
      event LineAdded
        lineNumber Int
        sku        String
    slice StateChange RemoveLine
      command RemoveLine
        orderId    OrderId identifier
        lineNumber Int
        produces LineRemoved
          for orderId
          lineNumber = lineNumber
      event LineRemoved
        lineNumber Int
    slice StateChange ShipOrder
      command ShipOrder
        orderId OrderId identifier
        carrier String
        produces Shipped
          for orderId
          carrier = carrier
        produces ShippingCleared
          for orderId
      event Shipped
        carrier String
      event ShippingCleared
    slice StateChange CancelOrder
      command CancelOrder
        orderId OrderId identifier
        produces OrderCancelled
          for orderId
      event OrderCancelled
    slice StateChange RenameCustomer
      command RenameCustomer
        customerId CustomerId identifier
        name       String
        produces CustomerRenamed
          for customerId
          name = name
        produces CustomerDeleted
          for customerId
      event CustomerRenamed
        name String
      event CustomerDeleted
    slice StateView OrderOverview
      readmodel OrderView
        orderId      OrderId
        customerId   CustomerId
        customerName String optional
        total        Decimal
        lastSeen     String
        lineCount    Int
        status       String
        lines        OrderLine[]
        shipping     Shipping
      query OrderViewById => OrderView optional
        by orderId OrderId
      projection OrderOverview => OrderView
        no automap
        every
          lastSeen = "seen"
        from OrderPlaced
          orderId    = $eventSourceId
          customerId = customerId
          total      = total
          status     = "placed"
        from LineAdded
          increment lineCount
        from LineRemoved
          decrement lineCount
        join Customer on customerId
          with CustomerRenamed
            customerName = name
        children lines identified by lineNumber
          from LineAdded key lineNumber
            sku = sku
          remove with LineRemoved key lineNumber
        nested shipping
          from Shipped
            carrier = carrier
          clear with ShippingCleared
        remove with OrderCancelled
  feature Items

module Work
  feature Items
    slice StateChange OpenIssue
      command OpenIssue
        issueId IssueId identifier
        title   String
        produces IssueCreated
          for issueId
          title = title
        produces IssueTitleCorrected
          for issueId
          title = title
      event IssueCreated
        title String
      event IssueTitleCorrected
        title String
    slice StateChange OpenPullRequest
      command OpenPullRequest
        issueId IssueId identifier
        status  String
        produces PullRequestCreated
          for issueId
        produces BuildCompleted
          for issueId
          status = status
      event PullRequestCreated
      event BuildCompleted
        status String
    slice StateView WorkItems
      readmodel BacklogItem
        issueId IssueId
        title   String
      readmodel PullRequestItem
        issueId     IssueId
        title       String
        buildStatus String
      query BacklogItemById => BacklogItem optional
        by issueId IssueId
      query PullRequestItemById => PullRequestItem optional
        by issueId IssueId
      projection WorkItem
        from IssueTitleCorrected
          title = title
        variant BacklogItem
          enters on IssueCreated
        variant PullRequestItem
          enters on PullRequestCreated
          from BuildCompleted
            buildStatus = status

module Bank
  feature Accounts
    slice StateChange Deposit
      command Deposit
        accountId AccountId identifier
        amount    Decimal
        code      Code
        produces Deposited
          for accountId
          amount = amount
        produces Withdrawn
          for accountId
          amount = amount
        produces Frozen
          for accountId
      event Deposited
        amount Decimal
      event Withdrawn
        amount Decimal
      event Frozen
      specification RejectingAnEmptyCode           // one concept rejection spec, through this command
        when Deposit
          accountId = "5d1f0c2e-8a47-4c1b-9b3e-6f2a7c9d1e10"
          amount    = 10
          code      = ""
        then error "Required"
    slice StateView Balance
      readmodel Account
        accountId AccountId
        balance   Decimal
        deposits  Int
        note      String optional
      query AccountById => Account optional
        by accountId AccountId
      projection Balances => Account
        all
          count deposits
        from Deposited
          accountId = $eventSourceId
          add balance by amount
          set note to "active"
        from Withdrawn
          subtract balance by amount
        from Frozen
          clear note
```
