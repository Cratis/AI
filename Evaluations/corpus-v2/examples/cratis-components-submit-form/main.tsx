import 'reflect-metadata';
import './host.css';
import {createRoot} from 'react-dom/client';
import {Arc} from '@cratis/arc.react';
import {CratisComponentsProvider} from '@cratis/components/Common';
import {AddAuthorButton} from './Features/Authors/Registration/AddAuthorButton';
createRoot(document.getElementById('root')!).render(<CratisComponentsProvider><Arc queryDirectMode><AddAuthorButton/></Arc></CratisComponentsProvider>);
