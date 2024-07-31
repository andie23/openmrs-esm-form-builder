import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { Question, Schema } from './types';
import type { ConfigObject } from './config-schema';

interface Field {
  label: string;
  concept?: string;
  id?: string;
  type?: string;
}

interface ErrorMessageResponse {
  errorMessage?: string;
  field: Field;
}

interface WarningMessageResponse {
  field: Field;
  warningMessage?: string;
}

export const handleFormValidation = async (
  schema: string | Schema,
  configObject: ConfigObject['dataTypeToRenderingMap'],
): Promise<[Array<ErrorMessageResponse>, Array<WarningMessageResponse>]> => {
  const errors: Array<ErrorMessageResponse> = [];
  const warnings: Array<WarningMessageResponse> = [];

  if (schema) {
    const parsedForm: Schema = typeof schema === 'string' ? JSON.parse(schema) : schema;

    const asyncTasks: Array<Promise<void>> = [];

    parsedForm.pages?.forEach((page) =>
      page.sections?.forEach((section: { questions: Array<Question> }) =>
        section.questions?.forEach((question) => {
          if (question.type === 'obs')
            asyncTasks.push(validateConceptsInQuestion(question, errors, configObject, warnings));
          else if (question.type === 'obsGroup') {
            question?.questions?.forEach((obsGrpQuestion) =>
              asyncTasks.push(validateConceptsInQuestion(obsGrpQuestion, errors, configObject, warnings)),
            );
          } else if (question.type === 'patientIdentifier')
            asyncTasks.push(handlePatientIdentifierValidation(question, errors));
          if (question.questionOptions.answers) asyncTasks.push(handleAnswerValidation(question, errors));
        }),
      ),
    );

    await Promise.all(asyncTasks);
  }

  return [errors, warnings]; // Return empty arrays if schema is falsy
};

const validateConceptsInQuestion = async (
  question: Question,
  errorsArray: Array<ErrorMessageResponse>,
  configObject: ConfigObject['dataTypeToRenderingMap'],
  warningsArray: Array<WarningMessageResponse>,
) => {
  const conceptRepresentation =
    'custom:(uuid,display,datatype,answers,conceptMappings:(conceptReferenceTerm:(conceptSource:(name),code)))';

  const searchRef = question.questionOptions.concept
    ? question.questionOptions.concept
    : question.questionOptions.conceptMappings?.length
      ? question.questionOptions.conceptMappings
          ?.map((mapping) => {
            return `${mapping.type}:${mapping.value}`;
          })
          .join(',')
      : '';

  const questionField = { id: question.id, label: question.label, concept: question.questionOptions?.concept };
  if (searchRef) {
    try {
      const { data } = await openmrsFetch(`${restBaseUrl}/concept?references=${searchRef}&v=${conceptRepresentation}`);
      if (data.results.length) {
        const [resObject] = data.results;
        resObject.datatype.name === 'Boolean' &&
          question.questionOptions.answers.forEach((answer) => {
            if (
              answer.concept !== 'cf82933b-3f3f-45e7-a5ab-5d31aaee3da3' &&
              answer.concept !== '488b58ff-64f5-4f8a-8979-fa79940b1594'
            ) {
              errorsArray.push({
                errorMessage: `❌ concept "${question.questionOptions.concept}" of type "boolean" has a non-boolean answer "${answer.label}"`,
                field: questionField,
              });
            }
          });

        resObject.datatype.name === 'Coded' &&
          question.questionOptions.answers.forEach((answer) => {
            if (!resObject.answers.some((answerObject) => answerObject.uuid === answer.concept)) {
              warningsArray.push({
                warningMessage: `⚠️ answer: "${answer.label}" - "${answer.concept}" does not exist in the response answers but exists in the form`,
                field: questionField,
              });
            }
          });

        dataTypeChecker(question, resObject, errorsArray, configObject);
      } else {
        errorsArray.push({
          errorMessage: `❓ Concept "${question.questionOptions.concept}" not found`,
          field: questionField,
        });
      }
    } catch (error) {
      console.error(error);
    }
  } else {
    errorsArray.push({
      errorMessage: `❓ No UUID`,
      field: questionField,
    });
  }
};

const handlePatientIdentifierValidation = async (question: Question, errors) => {
  if (question.type === 'patientIdentifier' && !question.questionOptions.identifierType) {
    errors.push({
      errorMessage: `❓ Patient identifier type missing in schema`,
      field: question,
    });
  }
  const patientIdentifier = question.questionOptions.identifierType;

  if (patientIdentifier) {
    try {
      const { data } = await openmrsFetch(
        `${restBaseUrl}/patientidentifiertype/${question.questionOptions.identifierType}`,
      );
      if (!data) {
        errors.push({
          errorMessage: `❓ The identifier type does not exist`,
          field: question,
        });
      }
    } catch (error) {
      console.error('Error fetching patient identifier:', error);
      errors.push({
        errorMessage: `❓ The identifier type does not exist`,
        field: question,
      });
    }
  }
};

const dataTypeChecker = (conceptObject, responseObject, array, dataTypeToRenderingMap) => {
  Object.prototype.hasOwnProperty.call(dataTypeToRenderingMap, responseObject.datatype.name) &&
    !dataTypeToRenderingMap[responseObject.datatype.name].includes(conceptObject.questionOptions.rendering) &&
    array.push({
      errorMessage: `❓ ${conceptObject.questionOptions.concept}: datatype "${responseObject.datatype.name}" doesn't match control type "${conceptObject.questionOptions.rendering}"`,
      field: conceptObject,
    });

  !Object.prototype.hasOwnProperty.call(dataTypeToRenderingMap, responseObject.datatype.name) &&
    array.push({
      errorMessage: `❓ Untracked datatype "${responseObject.datatype.name}"`,
      field: conceptObject,
    });
};

const handleAnswerValidation = async (questionObject: Question, errors: Array<ErrorMessageResponse>) => {
  const answerArray = questionObject.questionOptions.answers;
  const conceptRepresentation =
    'custom:(uuid,display,datatype,conceptMappings:(conceptReferenceTerm:(conceptSource:(name),code)))';

  if (answerArray?.length) {
    for (const answer of answerArray) {
      const searchRef = answer.concept
        ? answer.concept
        : answer.conceptMappings?.length
          ? answer.conceptMappings
              .map((eachMapping) => {
                return `${eachMapping.type}:${eachMapping.value}`;
              })
              .join(',')
          : '';

      try {
        const response = await openmrsFetch(
          `${restBaseUrl}/concept?references=${searchRef}&v=${conceptRepresentation}`,
        );
        if (!response.data.results.length) {
          errors.push({
            errorMessage: `❌ concept "${answer.concept}" not found`,
            field: answer,
          });
        }
      } catch (error) {
        console.error('Error fetching concept:', error);
      }
    }
  }
};
