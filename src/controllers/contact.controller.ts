import { Body, Controller, Delete, Get, Patch, Path, Post, Response, Route, Security, SuccessResponse, Tags } from 'tsoa';
import {
  ContactMessageDeleteResponse,
  ContactMessageListResponse,
  ContactMessageSingleResponse,
  CreateContactMessageRequest,
  UpdateContactMessageReadRequest,
} from '../interfaces/contact.interface';
import { StandardErrorResponse } from '../interfaces/auth.interface';
import { ContactService } from '../services/contact.service';
import { createContactMessageSchema, updateContactMessageReadSchema } from '../validators/contact.validator';

@Route('contact')
@Tags('Contact')
export class ContactController extends Controller {
  private contactService = new ContactService();

  @Post()
  @SuccessResponse('201', 'Created')
  @Response<StandardErrorResponse>(400, 'Validation Error')
  public async createMessage(@Body() requestBody: CreateContactMessageRequest): Promise<ContactMessageSingleResponse> {
    const validatedBody = createContactMessageSchema.parse(requestBody);
    const result = await this.contactService.createMessage(validatedBody);
    this.setStatus(201);
    return result;
  }

  @Get()
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  public async getAllMessages(): Promise<ContactMessageListResponse> {
    return this.contactService.getAllMessages();
  }

  @Get('{id}')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(404, 'Contact message not found')
  public async getMessageById(@Path() id: string): Promise<ContactMessageSingleResponse> {
    return this.contactService.getMessageById(id);
  }

  @Patch('{id}/read')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(400, 'Validation Error')
  @Response<StandardErrorResponse>(404, 'Contact message not found')
  public async updateMessageReadStatus(
    @Path() id: string,
    @Body() requestBody: UpdateContactMessageReadRequest,
  ): Promise<ContactMessageSingleResponse> {
    const validatedBody = updateContactMessageReadSchema.parse(requestBody);
    return this.contactService.updateMessageReadStatus(id, validatedBody);
  }

  @Delete('{id}')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(404, 'Contact message not found')
  public async deleteMessage(@Path() id: string): Promise<ContactMessageDeleteResponse> {
    return this.contactService.deleteMessage(id);
  }
}