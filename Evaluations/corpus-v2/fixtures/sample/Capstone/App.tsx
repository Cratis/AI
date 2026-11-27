// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DialogComponents } from '@cratis/arc.react/dialogs';
import { BusyIndicatorDialog, ConfirmationDialog } from '@cratis/components/Dialogs';
import { Authors } from './Authors/Authors';

function App() {
    return (
        <DialogComponents confirmation={ConfirmationDialog} busyIndicator={BusyIndicatorDialog}>
            <BrowserRouter>
                <Routes>
                    <Route path='/' element={<Authors />} />
                    {/* #region docs:authors-route */}
                    <Route path='/authors' element={<Authors />} />
                    {/* #endregion docs:authors-route */}
                </Routes>
            </BrowserRouter>
        </DialogComponents>
    );
}

export default App;
