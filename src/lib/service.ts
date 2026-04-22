import type {
	IntakeService,
	LibraryService,
	OperationsService,
	PipelineService,
	RuntimeAdminService,
	TagNormalizationService,
	TaxonomyService,
} from './types'
import { appRuntime } from './runtime'

export const runtimeAdminService: RuntimeAdminService = appRuntime.services.runtimeAdmin
export const pipelineService: PipelineService = appRuntime.services.pipeline
export const libraryService: LibraryService = appRuntime.services.library
export const operationsService: OperationsService = appRuntime.services.operations
export const taxonomyService: TaxonomyService = appRuntime.services.taxonomy
export const intakeService: IntakeService = appRuntime.services.intake
export const tagNormalizationService: TagNormalizationService = appRuntime.services.tagNormalization
