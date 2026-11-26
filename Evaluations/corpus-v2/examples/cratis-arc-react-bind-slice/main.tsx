import 'reflect-metadata';
import './host.css';
import {createRoot} from 'react-dom/client';
import {Arc} from '@cratis/arc.react';
import {CratisComponentsProvider} from '@cratis/components';
import {App} from './App';
createRoot(document.getElementById('root')!).render(<CratisComponentsProvider><Arc queryDirectMode><App/></Arc></CratisComponentsProvider>);
