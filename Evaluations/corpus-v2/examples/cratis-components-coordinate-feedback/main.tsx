import 'reflect-metadata';
import './host.css';
import {createRoot} from 'react-dom/client';
import {Arc} from '@cratis/arc.react';
import {CratisComponentsProvider} from '@cratis/components/Common';
import {DialogComponents} from '@cratis/arc.react/dialogs';
import {BusyIndicatorDialog, ConfirmationDialog} from '@cratis/components/Dialogs';
import {RemovalExample} from './Features/Authors/Removal/RemoveAuthorButton';
createRoot(document.getElementById('root')!).render(<CratisComponentsProvider><Arc queryDirectMode><DialogComponents confirmation={ConfirmationDialog} busyIndicator={BusyIndicatorDialog}><RemovalExample/></DialogComponents></Arc></CratisComponentsProvider>);
