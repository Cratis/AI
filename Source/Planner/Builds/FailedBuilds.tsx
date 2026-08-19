// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { DataPage } from '@cratis/components/DataPage';
import { FailedBuilds as FailedBuildsQuery, BuildStatus } from './Listing/Listing';
import { ScheduleAdHocWork } from '../Work/SchedulingAdHoc/SchedulingAdHoc';

const investigate = async (build: BuildStatus) => {
    const command = new ScheduleAdHocWork();
    command.prompt =
        `The "${build.workflow}" workflow is failing in ${build.owner}/${build.repository}. ` +
        `Look at the most recent run (${build.runUrl}) and fix it, or open an issue explaining what is wrong if it is not something you can fix.`;
    command.repositories = [`${build.owner}-${build.repository}`.toLowerCase()];
    await command.execute();
};

/**
 * The failed builds page - every workflow whose most recent run failed, across every tracked
 * repository, checked once a day by the consolidation. Goes green (and disappears) on its own once
 * the workflow does.
 */
export const FailedBuilds = () => (
    <DataPage
        title='Failed builds'
        query={FailedBuildsQuery}
        emptyMessage='Nothing is failing'
        dataKey='id'>
        <DataPage.Columns>
            <Column header='Repository' body={(build: BuildStatus) => `${build.owner}/${build.repository}`} style={{ width: '18rem' }} />
            <Column field='workflow' header='Workflow' />
            <Column
                header='Last run'
                body={(build: BuildStatus) => new Date(build.ranAt).toLocaleString()}
                style={{ width: '14rem' }} />
            <Column
                header='Diagnosis'
                body={(build: BuildStatus) => build.diagnosis
                    ? (
                        <div className='flex items-center gap-2'>
                            {build.fixable !== undefined &&
                                <Tag value={build.fixable ? 'Fixable' : 'Needs a person'} severity={build.fixable ? 'success' : 'warning'} />}
                            <span>{build.diagnosis}</span>
                        </div>
                    )
                    : <span className='text-[var(--text-color-secondary)]'>Not analyzed</span>}
                style={{ width: '22rem' }} />
            <Column
                style={{ width: '10rem' }}
                body={(build: BuildStatus) => (
                    <div className='flex gap-1'>
                        <Button icon='pi pi-search' rounded text size='small' tooltip='Investigate' onClick={() => investigate(build)} />
                        <Button icon='pi pi-external-link' rounded text size='small' tooltip='Open on GitHub' onClick={() => window.open(build.runUrl, '_blank')} />
                    </div>
                )} />
        </DataPage.Columns>
    </DataPage>
);
