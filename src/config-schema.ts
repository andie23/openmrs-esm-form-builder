import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  questionTypes: {
    _type: Type.Array,
    _description: 'Provides information that the processor uses to render a field',
    _default: [
      'complex-obs',
      'control',
      'encounterDatetime',
      'encounterLocation',
      'encounterProvider',
      'obs',
      'obsGroup',
      'personAttribute',
      'testOrder',
      'patientIdentifier',
    ],
  },
  fieldTypes: {
    _type: Type.Array,
    _description:
      'An array of available field types. A question can have only one field type, and the field type determines how the question is rendered.',
    _default: [
      'date',
      'drug',
      'field-set',
      'file',
      'group',
      'multiCheckbox',
      'number',
      'problem',
      'radio',
      'repeating',
      'select',
      'text',
      'textarea',
      'ui-select-extended',
    ],
  },
  showSchemaSaveWarning: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Whether to show a warning about possibly losing data in the forms dashboard',
  },
  componentFormEncounterTypeUuid: {
    _type: Type.String,
    _default: '88b84b7b-9d62-4e1e-a16c-a22df76d11ed',
    _description: 'The encounter type that the component form will be associated with',
  },
};
