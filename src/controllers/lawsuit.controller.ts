import { Request, Response } from "express";
import { AppError } from "../middlewares/AppError";
import { Client, Lawsuit } from "../models";

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