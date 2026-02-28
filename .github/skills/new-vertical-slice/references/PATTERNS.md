# Vertical Slice Patterns

## State Change — full example

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Applications.Commands;
using Cratis.Applications.ModelBinding;
using Cratis.Applications.Validation;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Projections;
using FluentValidation;
using MongoDB.Driver;

namespace MyApp.Projects.Registration;

// ─── Command ────────────────────────────────────────────────────────────────

[Route("/api/projects")]
public record RegisterProject(string Name) : ICommand
{
    [HttpPost("register")]
    public async Task<ProjectId> Handle(
        IEventLog eventLog,
        RegisterProjectRules rules)
    {
        var projectId = ProjectId.New();
        await eventLog.Append(projectId, new ProjectRegistered(projectId, Name));
        return projectId;
    }
}

// ─── Validator ──────────────────────────────────────────────────────────────

public class RegisterProjectValidator : AbstractValidator<RegisterProject>
{
    public RegisterProjectValidator()
    {
        RuleFor(c => c.Name).NotEmpty().MaximumLength(200);
    }
}

// ─── Business Rules ─────────────────────────────────────────────────────────

public class RegisterProjectRules(IMongoCollection<Project> projects) :
    RulesFor<RegisterProjectRules, RegisterProject>
{
    public override async Task Define(RegisterProject command, IRulesBuilder<RegisterProjectRules> rules)
    {
        var nameExists = await projects
            .Find(p => p.Name == command.Name)
            .AnyAsync();

        rules.RuleFor(r => r.NameMustBeUnique)
             .Must(() => !nameExists)
             .WithMessage($"A project named '{command.Name}' already exists.");
    }

    /// <summary>Indicates whether the project name is unique.</summary>
    public bool NameMustBeUnique { get; private set; }
}

// ─── Event ──────────────────────────────────────────────────────────────────

[EventType("c3b1e7f2-1234-5678-9abc-def012345678")]
public record ProjectRegistered(ProjectId ProjectId, string Name);

// ─── Read Model ─────────────────────────────────────────────────────────────

public record Project
{
    public ProjectId Id { get; init; }
    public string Name { get; init; } = string.Empty;
}

// ─── Projection ─────────────────────────────────────────────────────────────

public class ProjectProjection : IProjectionFor<Project>
{
    public ProjectionId Identifier => "e7c4a1b3-abcd-ef01-2345-6789abcdef01";

    public void Define(IProjectionBuilderFor<Project> builder) =>
        builder
            .AutoMap()                                          // ALWAYS first
            .From<ProjectRegistered>(builder =>
                builder.UsingKey(e => e.ProjectId));
}
```

---

## State View — full example

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Applications.Queries;
using Cratis.Chronicle.Projections;
using MongoDB.Driver;

namespace MyApp.Projects.Listing;

[Route("/api/projects")]
public record AllProjects : IQueryFor<IEnumerable<Project>>
{
    [HttpGet]
    public async Task<IEnumerable<Project>> Define(IMongoCollection<Project> collection) =>
        await collection.Find(_ => true).ToListAsync();
}
```

For paged queries:

```csharp
[Route("/api/projects")]
public record AllProjectsPaged : IQueryFor<IEnumerable<Project>>
{
    [HttpGet("paged")]
    public async Task<ClientObservable<IEnumerable<Project>>> Define(
        IMongoCollection<Project> collection) =>
        collection.FindAsync(_ => true, new FindOptions<Project> { Sort = Builders<Project>.Sort.Ascending(p => p.Name) });
}
```

---

## Automation (Reactor) — full example

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Events;
using Cratis.Chronicle.Reactors;

namespace MyApp.Projects.Notifications;

public class ProjectRegisteredNotifier(INotificationService notifications) :
    IReactorFor<ProjectRegistered>
{
    public async Task On(ProjectRegistered @event, EventContext context) =>
        await notifications.Notify($"Project '{@event.Name}' was registered.");
}
```

**Rules:**
- Reactors MUST be idempotent — they can be called more than once per event
- Do not read back from the read model; use event data directly
- To append new events, use a separate outbox to prevent feedback loops

---

## Translation — full example

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Events;
using Cratis.Chronicle.Reactors;

namespace MyApp.Projects.Enrichment;

public class ProjectEnricher(IEventLog eventLog) :
    IReactorFor<ProjectRegistered>
{
    public async Task On(ProjectRegistered @event, EventContext context)
    {
        var enriched = await LookupExternalData(@event.ProjectId);
        await eventLog.Append(@event.ProjectId, new ProjectEnriched(@event.ProjectId, enriched.Category));
    }

    Task<ExternalData> LookupExternalData(ProjectId id) => ...;
}
```

---

## Frontend — complete component examples

### Listing component with paging

```tsx
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { AllProjects } from './AllProjects';

const pageSize = 10;

export const Listing = () => {
    const [result, , setPage] = AllProjects.useWithPaging(pageSize);

    return (
        <DataTable
            lazy paginator
            value={result.data}
            rows={pageSize}
            totalRecords={result.paging.totalItems}
            alwaysShowPaginator={false}
            first={result.paging.page * pageSize}
            onPage={event => setPage(event.page ?? 0)}
            scrollable scrollHeight="flex"
            emptyMessage="No projects found.">
            <Column field="name" header="Name" />
        </DataTable>
    );
};
```

### CommandDialog for state-change commands

```tsx
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import { DialogProps, DialogResult } from '@cratis/arc.react/dialogs';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputText } from 'primereact/inputtext';
import { RegisterProject } from './RegisterProject';

export const AddProject = ({ closeDialog }: DialogProps) => {
    const [name, setName] = useState('');

    return (
        <CommandDialog
            command={RegisterProject}
            visible
            header="Add Project"
            width="32rem"
            confirmLabel="Add"
            cancelLabel="Cancel"
            onBeforeExecute={(values) => {
                values.name = name;
                return values;
            }}
            onConfirm={() => closeDialog(DialogResult.Ok)}
            onCancel={() => closeDialog(DialogResult.Cancelled)}>
            <CommandDialog.Fields>
                <InputText
                    value={name}
                    onChange={event => setName(event.target.value)}
                    autoFocus
                />
            </CommandDialog.Fields>
        </CommandDialog>
    );
};
```

### Composition page

```tsx
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { DialogResult, useDialog } from '@cratis/arc.react/dialogs';
import { Menubar } from 'primereact/menubar';
import { MenuItem } from 'primereact/menuitem';
import * as mdIcons from 'react-icons/md';
import { Page } from '../../Core/Page';
import { AddProject } from './Registration/AddProject';
import { Listing } from './Listing/Listing';

export const Projects = () => {
    const [AddProjectDialog, showAddProjectDialog] = useDialog(AddProject);

    const menuItems: MenuItem[] = [
        {
            label: 'Add Project',
            icon: mdIcons.MdAdd,
            command: async () => { await showAddProjectDialog(); }
        }
    ];

    return (
        <Page title="Projects">
            <Menubar model={menuItems} />
            <Listing />
            <AddProjectDialog />
        </Page>
    );
};
```
