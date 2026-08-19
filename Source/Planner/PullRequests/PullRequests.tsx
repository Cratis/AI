// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { AllPullRequests, OpenPullRequests, PullRequest } from './Listing/Listing';

const statusTag = (pullRequest: PullRequest) => {
    if (pullRequest.isOpen) {
        return <Tag value='Open' severity='info' />;
    }

    return pullRequest.merged
        ? <Tag value='Merged' severity='success' />
        : <Tag value='Closed' severity='danger' />;
};

/**
 * The pull requests page - every pull request mirrored from GitHub across the Planner's tracked
 * repositories, kept current by the GitHub webhook.
 */
export const PullRequests = () => {
    const [showDone, setShowDone] = useState(false);

    return (
        <DataPage
            title='Pull requests'
            query={(showDone ? AllPullRequests : OpenPullRequests) as unknown as typeof AllPullRequests}
            emptyMessage='No pull requests mirrored yet'
            dataKey='id'>
            <DataPage.MenuItems>
                <MenuItem
                    label={showDone ? 'Hide done' : 'Show done'}
                    icon={() => <i className={showDone ? 'pi pi-eye-slash' : 'pi pi-eye'} />}
                    command={() => setShowDone((current) => !current)} />
            </DataPage.MenuItems>
            <DataPage.Columns>
                <Column header='Repository' body={(pullRequest: PullRequest) => `${pullRequest.owner}/${pullRequest.repository}`} style={{ width: '16rem' }} />
                <Column header='Pull request' body={(pullRequest: PullRequest) => `#${pullRequest.number} ${pullRequest.title}`} />
                <Column field='createdBy' header='Opened by' style={{ width: '10rem' }} />
                <Column
                    header='Opened'
                    body={(pullRequest: PullRequest) => new Date(pullRequest.createdAt).toLocaleDateString()}
                    style={{ width: '8rem' }} />
                <Column header='Status' body={statusTag} style={{ width: '8rem' }} />
                <Column
                    style={{ width: '3rem' }}
                    body={(pullRequest: PullRequest) =>
                        <Button icon='pi pi-external-link' rounded text size='small' tooltip='Open on GitHub' onClick={() => window.open(pullRequest.url, '_blank')} />} />
            </DataPage.Columns>
        </DataPage>
    );
};
