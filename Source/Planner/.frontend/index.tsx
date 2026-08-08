// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PrimeReactProvider } from 'primereact/api';
import ReactDOM from 'react-dom/client';
import 'primeicons/primeicons.css';
import './index.css';
import React from 'react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <PrimeReactProvider value={{
            ripple: true,
            zIndex: {
                modal: 10100,
                overlay: 10000,
                menu: 10000,
                tooltip: 10100,
                toast: 10200,
            },
        }}>
            <App />
        </PrimeReactProvider>
    </React.StrictMode>
);
