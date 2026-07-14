import { Schema } from "effect"
import { ascending } from "./identifier"
import { statics } from "./schema"

export const ThreadID = Schema.String.check(Schema.isStartsWith("thr")).pipe(
  Schema.brand("ThreadID"),
  statics((schema) => {
    const create = () => schema.make("thr_" + ascending())
    return {
      ascending: (id?: string) => {
        if (!id) return create()
        if (!id.startsWith("thr")) throw new Error(`ID ${id} does not start with thr`)
        return schema.make(id)
      },
      create,
    }
  }),
)
export type ThreadID = typeof ThreadID.Type
