// Consulta de identidade confirmada pelo servidor (não só a sessão guardada no navegador).
import { classifySaveError, SaveError } from './errors'
import { supabase } from './supabase'

/** ID da conta logada segundo o servidor. Falha de rede vira SaveError('network'), não "deslogado". */
export async function getConfirmedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    const status = (error as { status?: number }).status
    throw new SaveError(classifySaveError(error, status), error.message)
  }
  return data.user?.id ?? null
}
