// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Arc } from '@cratis/arc.react';
import { QueryTransportMethod } from '@cratis/arc/queries';
import { Bindings, MVVM } from '@cratis/arc.react.mvvm';
import '@cratis/components/styles';
import { AppLayout } from '../Layout/AppLayout';
import { Dashboard } from '../Dashboard/Dashboard';
import { Issues } from '../Issues/Issues';
import { Alerts } from '../Alerts/Alerts';
import { Work } from '../Work/Work';
import { PullRequests } from '../PullRequests/PullRequests';
import { FailedBuilds } from '../Builds/FailedBuilds';
import { Repositories } from '../Repositories/Repositories';
import { GitHubConfiguration } from '../GitHub/GitHubConfiguration';
import { ClaudeAccounts } from '../Accounts/ClaudeAccounts';
import { Usage } from '../Accounts/Usage/UsagePage';

const isDevelopment = import.meta.env.MODE === 'development';

Bindings.initialize();

function App() {
    return (
        <Arc development={isDevelopment} queryTransportMethod={QueryTransportMethod.WebSocket}>
            <MVVM>
                <BrowserRouter>
                    <Routes>
                        <Route path='/' element={<AppLayout />}>
                            <Route path='' element={<Dashboard />} />
                            <Route path='issues' element={<Issues />} />
                            <Route path='alerts' element={<Alerts />} />
                            <Route path='work' element={<Work />} />
                            <Route path='pull-requests' element={<PullRequests />} />
                            <Route path='failed-builds' element={<FailedBuilds />} />
                            <Route path='usage' element={<Usage />} />
                            <Route path='settings/repositories' element={<Repositories />} />
                            <Route path='settings/github' element={<GitHubConfiguration />} />
                            <Route path='settings/accounts' element={<ClaudeAccounts />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </MVVM>
        </Arc>
    );
}

export default App;
