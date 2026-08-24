import { Request, Response } from "express";
import { AppError } from "../middlewares/AppError";
import { Client, Lawsuit } from "../models";
import { enqueueLawsuitSync } from '../queues/lawsuitSync.queue.js';

interface BatchImportItem {
    cnjNumber?: string;
    clientId?: string;
}

interface BatchImportBody {
    items?: BatchImportItem[];
}

interface BatchImportResultItem {
    cnjNumber: string;
    lawsuitId: string;
    wasNew: boolean;
    enqueue: boolean;
}



/**
 * POST /api/lawsuits/batch-import
 *
 * Para cada item: garante que o processo exista (upsert por cnjNumber)
 * e enfileira um job de sincronização. O processamento em si acontece
 * no Worker (próximo passo) — este endpoint nunca espera por isso, só
 * enfileira e responde.
 */


export async function batchImportLawsuits(req: Request<unknown, unknown, BatchImportBody>, res: Response){
    const {items} = req.body;
    if(!Array.isArray(items) || items.length===0) {
        throw new AppError('O campo "items" deve ser uma lista não vazia de {cnjNumber, clientId}.', 422);
    }

    const invalidIndex = items.findIndex((item)=> !item.cnjNumber || !item.clientId);
    if(invalidIndex !== -1){
        throw new AppError(`Item invalido no indice ${invalidIndex}: "cnjNumber" e "clientId" são obrigatórios.`, 422);
    }

    const results: BatchImportResultItem[] = [];

    for (const item of items) {
        const cnjNumber = item.cnjNumber as string;
        const clientId = item.clientId as string;

        const client = await Client.findById(clientId);
        if(!client){
            throw new AppError(`Cliente "${clientId}" (item cnjNumber=${cnjNumber}) não existe.`, 404);
        }

        // O Mongoose não tem um "findOrCreate" pronto (diferente do
        // Sequelize, V2) — findOneAndUpdate com upsert:true é o equivalente
        // idiomático. `rawResult: true` devolve o resultado cru do driver,
        // com `lastErrorObject.upserted` indicando se um documento NOVO foi
        // inserido (em vez de um já existente ter sido encontrado).

        // const upsertResult = await Lawsuit.findOneAndUpdate(
        //     { cnjNumber },
        //     { $setOnInsert: { cnjNumber, clientId } },
        //     { new: true, upsert: true, rawResult: true }
        // );

        // Faz o upsert e já pega o documento atualizado ou criado diretamente
        const lawsuit = await Lawsuit.findOneAndUpdate(
            { cnjNumber },
            { $setOnInsert: { cnjNumber, clientId } },
            { new: true, upsert: true, returnDocument: 'after' } // Substitui rawResult por returnDocument para sumir com o Warning do Mongoose também
        );

        // Como o Mongoose agora garante que retorna o documento (ou criamos com upsert), 
        // podemos validar de forma segura:
        if (!lawsuit) {
            throw new AppError(`Erro ao processar o processo ${cnjNumber}`, 500);
        }

        // Para saber se era novo, podemos olhar se a data de criação é igual à de atualização 
        // ou usar a lógica de ver se ele foi recém-inserido comparando os campos, 
        // mas se quiser apenas garantir que o código não quebre:
        const wasNew = lawsuit.createdAt?.getTime() === lawsuit.updatedAt?.getTime();

        await enqueueLawsuitSync({ lawsuitId: String(lawsuit._id), cnjNumber: String(lawsuit.cnjNumber) });

        results.push({
            cnjNumber,
            lawsuitId: String(lawsuit._id),
            wasNew,
            enqueue: true,
        });
    }

    return res.status(202).json({
        message: 'Importação em lote aceita - jobs de sincronização enfileirados',
        itemsReceived: items.length,
        results,
    })
}




interface CreateLawsuitBody {
    cnjNumber?: string;
    clientId?: string;
    status?: string
}


/**
 * POST /api/lawsuits
 * Vincula um número CNJ a um cliente existente.
 */
export async function createLawsuit(req: Request<unknown, unknown, CreateLawsuitBody>, res: Response){

    const {cnjNumber, clientId, status} = req.body;
    if(!cnjNumber || !clientId){
        throw new AppError('Os campos "cnjNumber" e "clientId" são obrigatórios.', 422);
    }

    const client = await Client.findById(clientId);
    if(!client) {
        throw new AppError('Cliente informado não existe.', 404);
    }

    const lawsuit = await Lawsuit.create({cnjNumber, clientId, status})

    return res.status(201).json(lawsuit);

}


/**
 * GET /api/lawsuits/:id
 * Retorna o processo e o cliente vinculado.
 */

export async function getLawsuitById(req: Request, res: Response){
    const lawsuitId = req.params.id;

    const lawsuit = await Lawsuit.findById(lawsuitId).populate('client');
    
    if(!lawsuit){
        throw new AppError('Processo não encontrado.', 404);
    }

    return res.status(200).json(lawsuit);
}