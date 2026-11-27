import 'reflect-metadata';
import './host.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Arc } from '@cratis/arc.react';
import { MVVM } from '@cratis/arc.react.mvvm';
import { CratisComponentsProvider } from '@cratis/components/Common';
import { AuthorSearch } from './Features/Authors/Listing/AuthorSearch';

createRoot(document.getElementById('root')!).render(
    <CratisComponentsProvider><Arc queryDirectMode><MVVM><BrowserRouter><AuthorSearch /></BrowserRouter></MVVM></Arc></CratisComponentsProvider>
);
