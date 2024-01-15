import { SkipThrottle } from '@nestjs/throttler'
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Req
} from '@nestjs/common'
import { Request } from 'express'

import { BlogsRequestParams } from '../types/blogs'
import { RequestParams, ResponseBody } from '../types/request'
import { IBlog } from '../types/blogs'
import { appMessages } from '../constants/messages'
import { IPost } from '../types/posts'
import { JWTService } from '../jwt/jwt.service'
import { RoutesEnum } from '../constants/global'
import { BlogsSqlRepository } from './blogs.repository.sql'
import { PostsSqlRepository } from '../posts/posts.repository.sql'

@SkipThrottle()
@Controller(RoutesEnum.blogs)
export class BlogsController {
  constructor(
    private blogsSqlRepository: BlogsSqlRepository,
    private postsSqlRepository: PostsSqlRepository,
    private JWTService: JWTService,
  ) {}

  @Get()
  async getAll(
    @Query() query: BlogsRequestParams
  ): Promise<ResponseBody<IBlog> | []> {
    const blogs = await this.blogsSqlRepository.getAll(query)

    return blogs
  }

  @Get(':id')
  async getBlogById(@Param() params: { id: string }): Promise<IBlog | null> {
    const blog = await this.blogsSqlRepository.getById(params.id)

    if (!blog) {
      throw new HttpException(
        { message: appMessages(appMessages().blog).errors.notFound },
        HttpStatus.NOT_FOUND
      )
    }

    return blog
  }

  @Get(':blogId/posts')
  async getPostsByBlogId(
    @Query() query: RequestParams,
    @Param() params: { blogId: string },
    @Req() req: Request
  ): Promise<ResponseBody<IPost> | []> {
    let currentUserId: string | null = null

    if (!params.blogId) {
      throw new HttpException(
        {
          message: appMessages(appMessages().blogId).errors.isRequiredParameter,
          field: ''
        },
        HttpStatus.NOT_FOUND
      )
    }

    const blog = await this.blogsSqlRepository.getById(params.blogId)

    if (!blog) {
      throw new HttpException(
        { message: appMessages(appMessages().blog).errors.notFound },
        HttpStatus.NOT_FOUND
      )
    }

    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1]
      try {
      const { userId } = this.JWTService.verifyAccessToken(token)
      currentUserId = userId || null
      } catch {
        console.log('err')
      }
    }

    const posts = await this.postsSqlRepository.getAll(query, currentUserId, blog.id)

    return posts
  }
}
