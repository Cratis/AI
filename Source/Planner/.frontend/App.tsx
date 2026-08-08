// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Arc } from '@cratis/arc.react';
import { QueryTransportMethod } from '@cratis/arc/queries';
import { Bindings, MVVM } from '@cratis/arc.react.mvvm';
import '@cratis/components/styles';
import { AppLayout } from '../Layout/AppLayout';
import { Issues } from '../Issues/Issues';
import { Work } from '../Work/Work';
import { Repositories } from '../Repositories/Repositories';
import { ClaudeAccounts } from '../Accounts/ClaudeAccounts';

const isDevelopment = import.meta.env.MODE === 'development';

Bindings.initialize();

function App() {
    return (
        <Arc development={isDevelopment} queryTransportMethod={QueryTransportMethod.WebSocket}>
            <MVVM>
                <BrowserRouter>
                    <Routes>
                        <Route path='/' element={<AppLayout />}>
                            <Route path='' element={<Issues />} />
                            <Route path='work' element={<Work />} />
                            <Route path='settings/repositories' element={<Repositories />} />
                            <Route path='settings/accounts' element={<ClaudeAccounts />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </MVVM>
        </Arc>
    );
}

export default App;
