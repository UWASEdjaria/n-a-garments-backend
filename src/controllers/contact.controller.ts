import {
  Body,
  Controller,
  Post,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';
import { ContactService } from '../services/contact.service';
import {
  ContactMessageResponse,
  CreateContactMessageRequest,
} from '../interfaces/contact.interface';
import { StandardErrorResponse } from '../interfaces/auth.interface';

const contactService = new ContactService();

@Route('contact')
@Tags('Contact')
export class ContactController extends Controller {
  /** Store a public contact message */
  @Post()
  @SuccessResponse('201', 'Created')
  @Response<StandardErrorResponse>(400, 'Bad Request')
  public async createMessage(
    @Body() requestBody: CreateContactMessageRequest
  ): Promise<ContactMessageResponse> {
    const result = await contactService.createMessage(requestBody);
    this.setStatus(201);
    return result;
  }
}