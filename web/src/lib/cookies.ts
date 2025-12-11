import Cookies from 'js-cookie'

export interface CookieOptions {
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  path?: string
}

export function getCookie(name: string): string | undefined {
  return Cookies.get(name)
}

export function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  const { maxAge, ...rest } = options
  const cookieOptions = maxAge
    ? { ...rest, expires: maxAge / 86400 } // Convert seconds to days for js-cookie
    : rest
  Cookies.set(name, value, cookieOptions)
}

export function removeCookie(name: string, path: string = '/'): void {
  Cookies.remove(name, { path })
}
