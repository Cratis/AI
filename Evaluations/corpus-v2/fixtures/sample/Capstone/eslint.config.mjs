import cratis from '@cratis/eslint-config';
import arc from '@cratis/eslint-plugin-arc';
import components from '@cratis/eslint-plugin-components';

export default [
    ...cratis.configs.consumer,
    ...arc.configs.recommended,
    ...components.configs.recommended,
];
