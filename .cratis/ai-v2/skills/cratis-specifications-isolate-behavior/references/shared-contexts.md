# Share setup, not the decision

Extract a `given` base context only when two cases need the same dependencies or prior state. Put that construction in its `Establish`, and disposal of resources it creates in `Destroy`. Keep the action in the concrete `when_` class. A second action hidden in a base class changes the meaning of every derived failure. Check the two contexts can run separately without static mutable state or an execution-order assumption.
