// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using NSubstitute.ReturnsExtensions;

namespace Planner.Work.Authorizing.for_WorkTokens.given;

public class a_work_token_store : Specification
{
    protected static readonly WorkId _workId = WorkId.New();

    protected IEventStore _eventStore;
    protected IEventLog _eventLog;
    protected IReadModels _readModels;
    protected WorkTokens _workTokens;

    void Establish()
    {
        _eventLog = Substitute.For<IEventLog>();
        _readModels = Substitute.For<IReadModels>();
        _readModels.GetInstanceById<WorkAuthorization>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>()).ReturnsNull();

        _eventStore = Substitute.For<IEventStore>();
        _eventStore.EventLog.Returns(_eventLog);
        _eventStore.ReadModels.Returns(_readModels);

        _workTokens = new(_eventStore);
    }

    protected void IssuedTokenIs(WorkToken token) =>
        _readModels.GetInstanceById<WorkAuthorization>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(new WorkAuthorization(_workId, token));
}
#endif
