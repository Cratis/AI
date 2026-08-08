// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PrimeReactProvider } from 'primereact/api';
import ReactDOM from 'react-dom/client';
import 'primeicons/primeicons.css';
import './index.css';
import React from 'react';
import App from './App';

// Layering (dialogs, dropdown panels, tooltips) is managed by @cratis/components - no custom
// z-index configuration here; overriding it puts dropdown panels behind dialogs.
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <PrimeReactProvider value={{ ripple: true }}>
            <App />
        </PrimeReactProvider>
    </React.StrictMode>
);
