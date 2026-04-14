import type { CareerService } from './types'
import { localService } from './local-service'
import { tauriService } from './tauri-service'

const isTauri = '__TAURI_INTERNALS__' in window
export const careerService: CareerService = isTauri ? tauriService : localService
