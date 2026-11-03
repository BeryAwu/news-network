import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { normalizeHostname } from "@/lib/security";
export async function resolvePublicMedia(slug:string){const incoming=(await headers()).get("host");if(!incoming)notFound();let hostname:string;try{hostname=normalizeHostname(incoming.split(":")[0]!);}catch{notFound();}const domain=await db.domain.findFirst({where:{hostname,isActive:true,verificationStatus:"VERIFIED",mediaSite:{slug,status:"ACTIVE"}},include:{mediaSite:{include:{profile:true,categories:{where:{isActive:true},orderBy:{sortOrder:"asc"}}}}}});if(!domain)notFound();return domain.mediaSite;}
