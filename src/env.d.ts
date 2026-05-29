/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '../../data/meta/universities.json' {
  import type { University } from '@/api/client'
  const value: University[]
  export default value
}

declare module '../../data/meta/fields.json' {
  import type { Field } from '@/api/client'
  const value: Field[]
  export default value
}

declare module '../../data/meta/journals.json' {
  import type { Journal } from '@/api/client'
  const value: Journal[]
  export default value
}
