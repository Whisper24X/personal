import {
  Delete,
  HttpCode,
  HttpStatus,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { BusinessLinesService } from './business-lines.service';
import { CreateBusinessLineDto } from './dto/create-business-line.dto';
import { UpdateBusinessLineDto } from './dto/update-business-line.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BusinessLine } from './domain/business-line';
import { AuthGuard } from '@nestjs/passport';
import { BusinessLineMember } from './domain/business-line-member';
import { CreateBusinessLineMemberDto } from './dto/create-business-line-member.dto';
import { UpdateBusinessLineMemberDto } from './dto/update-business-line-member.dto';
import { CreateBusinessLineInviteDto } from './dto/create-business-line-invite.dto';
import { BusinessLineInviteDto } from './dto/business-line-invite.dto';
import { AcceptBusinessLineInviteDto } from './dto/accept-business-line-invite.dto';
import { AcceptBusinessLineInviteResponseDto } from './dto/accept-business-line-invite-response.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllBusinessLinesDto } from './dto/find-all-business-lines.dto';
import { NullableType } from '../utils/types/nullable.type';
import { BusinessLineDto } from './dto/business-line.dto';

@ApiTags('Businesslines')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'business-lines',
  version: '1',
})
export class BusinessLinesController {
  constructor(private readonly businessLinesService: BusinessLinesService) {}

  @Post()
  @ApiCreatedResponse({
    type: BusinessLineDto,
  })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Body() createBusinessLineDto: CreateBusinessLineDto,
  ) {
    return this.businessLinesService.create(
      createBusinessLineDto,
      request.user,
    );
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(BusinessLineDto),
  })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request,
    @Query() query: FindAllBusinessLinesDto,
  ): Promise<InfinityPaginationResponseDto<BusinessLine>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.businessLinesService.findAllWithPagination({
        currentUser: request.user,
        paginationOptions: {
          page,
          limit,
        },
      }),
      { page, limit },
    );
  }

  @Post('invitations/accept')
  @ApiOkResponse({
    type: AcceptBusinessLineInviteResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  acceptInvite(
    @Request() request,
    @Body() acceptBusinessLineInviteDto: AcceptBusinessLineInviteDto,
  ) {
    return this.businessLinesService.acceptInvite(
      acceptBusinessLineInviteDto,
      request.user,
    );
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: BusinessLineDto,
  })
  @HttpCode(HttpStatus.OK)
  findById(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NullableType<BusinessLine>> {
    return this.businessLinesService.findById(id, request.user);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: BusinessLineDto,
  })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBusinessLineDto: UpdateBusinessLineDto,
  ) {
    return this.businessLinesService.update(
      id,
      updateBusinessLineDto,
      request.user,
    );
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.businessLinesService.remove(id, request.user);
  }

  @Get(':businessLineId/members')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: BusinessLineMember,
    isArray: true,
  })
  @HttpCode(HttpStatus.OK)
  findMembers(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
  ) {
    return this.businessLinesService.findMembers(businessLineId, request.user);
  }

  @Post(':businessLineId/members')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiCreatedResponse({
    type: BusinessLineMember,
  })
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Body() createBusinessLineMemberDto: CreateBusinessLineMemberDto,
  ) {
    return this.businessLinesService.addMember(
      businessLineId,
      createBusinessLineMemberDto,
      request.user,
    );
  }

  @Post(':businessLineId/invitations')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiCreatedResponse({
    type: BusinessLineInviteDto,
  })
  @HttpCode(HttpStatus.CREATED)
  createInvite(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Body() createBusinessLineInviteDto: CreateBusinessLineInviteDto,
  ) {
    return this.businessLinesService.createInvite(
      businessLineId,
      createBusinessLineInviteDto,
      request.user,
    );
  }

  @Patch(':businessLineId/members/:userId')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'userId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: BusinessLineMember,
  })
  @HttpCode(HttpStatus.OK)
  updateMemberRole(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateBusinessLineMemberDto: UpdateBusinessLineMemberDto,
  ) {
    return this.businessLinesService.updateMemberRole(
      businessLineId,
      userId,
      updateBusinessLineMemberDto,
      request.user,
    );
  }

  @Delete(':businessLineId/members/:userId')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'userId',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.businessLinesService.removeMember(
      businessLineId,
      userId,
      request.user,
    );
  }
}
