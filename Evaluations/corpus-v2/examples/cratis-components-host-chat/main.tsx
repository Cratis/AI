import 'reflect-metadata';
import './host.css';
import {createRoot} from 'react-dom/client';
import {Arc} from '@cratis/arc.react';
import {CratisComponentsProvider} from '@cratis/components/Common';
import {View} from './View';
createRoot(document.getElementById('root')!).render(<CratisComponentsProvider><Arc queryDirectMode><View/></Arc></CratisComponentsProvider>);
