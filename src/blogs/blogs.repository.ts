import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { CreateBlogDto } from '../dtos/blogs/create-blog.dto';
import { ResponseBody } from '../types/request';
import { BlogsRequestParams, IBlogForSA } from '../types/blogs';
import { IBlog } from '../types/blogs';
import { UpdateBlogDto } from '../dtos/blogs/update-blog.dto';
import { SortDirections, SortType } from '../constants/global';
import { BlogEntity } from '../entities/blog';
import { UserEntity } from '../entities/user';

@Injectable()
export class BlogsRepository {
  constructor(
    @InjectDataSource() protected dataSource: DataSource,

    @InjectRepository(BlogEntity)
    private readonly blogsRepo: Repository<BlogEntity>
  ) {}

  async getAll(
    params: BlogsRequestParams
  ): Promise<ResponseBody<IBlog> | []> {
    try {
      const {
        sortBy = 'createdAt',
        sortDirection = SortDirections.desc,
        pageNumber = 1,
        pageSize = 10,
        searchNameTerm = ''
      } = params

      let whereFilter = ''
      const pageSizeNumber = Number(pageSize)
      const pageNumberNum = Number(pageNumber)
      const skip = (pageNumberNum - 1) * pageSizeNumber

      const query = this.blogsRepo.createQueryBuilder('blog')

      if (searchNameTerm) {
        whereFilter = 'blog.name ILIKE :name'
      }

      const searchObject = query
        .where(whereFilter, {
          name: searchNameTerm ? `%${searchNameTerm}%` : undefined
        })
        .select([
          'blog.id',
          'blog.name',
          'blog.description',
          'blog.websiteUrl',
          'blog.createdAt',
          'blog.isMembership'
        ])
        .addOrderBy(
          `blog.${sortBy}`,
          sortDirection?.toLocaleUpperCase() as SortType
        )
        .skip(skip)
        .take(pageSizeNumber)

      const blogs = await searchObject.getMany()
      const count = await searchObject.getCount()
      const pagesCount = Math.ceil(count / pageSizeNumber)

      return {
        pagesCount,
        page: pageNumberNum,
        pageSize: pageSizeNumber,
        totalCount: count,
        items: blogs
      }
    } catch {
      return []
    }
  }

  async getAllBySA(
    params: BlogsRequestParams
  ): Promise<ResponseBody<IBlogForSA> | []> {
    try {
      const {
        sortBy = 'createdAt',
        sortDirection = SortDirections.desc,
        pageNumber = 1,
        pageSize = 10,
        searchNameTerm = ''
      } = params

      let whereFilter = ''
      const pageSizeNumber = Number(pageSize)
      const pageNumberNum = Number(pageNumber)
      const skip = (pageNumberNum - 1) * pageSizeNumber

      const query = this.blogsRepo.createQueryBuilder('blog')

      if (searchNameTerm) {
        whereFilter = 'blog.name ILIKE :name'
      }

      const searchObject = query
        .where(whereFilter, {
          name: searchNameTerm ? `%${searchNameTerm}%` : undefined
        })
        .select('blog.*')
        .addSelect((subQuery) => {
          return subQuery
            .select('user.login', 'userLogin')
            .from(UserEntity, 'user')
            .where('blog.ownerId = user.id')
        }, 'userLogin')
        .addOrderBy(
          `blog.${sortBy}`,
          sortDirection?.toLocaleUpperCase() as SortType
        )
        .skip(skip)
        .take(pageSizeNumber)

      const blogs = await searchObject.getRawMany()
      console.log("🚀 ~ BlogsRepository ~ blogs:", blogs)
      const count = await searchObject.getCount()
      const pagesCount = Math.ceil(count / pageSizeNumber)

      const preparedBlogs = blogs.map(blog => ({
        id: blog.id,
        name: blog.name,
        description: blog.description,
        websiteUrl: blog.websiteUrl,
        createdAt: blog.createdAt,
        isMembership: blog.isMembership,
        blogOwnerInfo: {
          userId: blog.ownerId,
          userLogin: blog.userLogin
        }
      }))

      return {
        pagesCount,
        page: pageNumberNum,
        pageSize: pageSizeNumber,
        totalCount: count,
        items: preparedBlogs
      }
    } catch {
      return []
    }
  }

  async getById(id: string): Promise<BlogEntity | null> {
    const blog = this.blogsRepo
      .createQueryBuilder('blog')
      .select([
        'blog.id',
        'blog.name',
        'blog.description',
        'blog.websiteUrl',
        'blog.createdAt',
        'blog.isMembership',
      ])
      .where('blog.id = :id', { id })
      .getOne()

    if (!blog) {
      return null
    }

    return blog
  }

  async createBlog(data: CreateBlogDto): Promise<BlogEntity | null> {
    try {
      const query = this.blogsRepo.createQueryBuilder('blog')

      const newBlog = await query
        .insert()
        .values({
          name: data.name,
          description: data.description,
          websiteUrl: data.websiteUrl,
        })
        .execute()

      const blog = await this.getById(newBlog.raw[0].id)

      if (!blog) {
        return null
      }

      return blog
    } catch {
      return null
    }
  }

  async updateBlog(blogId: string, data: UpdateBlogDto): Promise<boolean> {
    const updatedBlog = await this.blogsRepo
        .createQueryBuilder('blog')
        .update()
        .set({ name: data.name, description: data.description, websiteUrl: data.websiteUrl })
        .where('id = :id', {
          id: blogId
        })
        .execute()

      if (!updatedBlog.affected) {
        return false
      }

      return true
  }

  async bindBlog(blogId: string, userId: string): Promise<boolean> {
    const updatedBlog = await this.blogsRepo
        .createQueryBuilder('blog')
        .update()
        .set({ ownerId: userId })
        .where('id = :id', {
          id: blogId
        })
        .execute()

      if (!updatedBlog.affected) {
        return false
      }

      return true
  }

  async deleteBlog(id: string) {
    try {
      const blog = await this.blogsRepo
        .createQueryBuilder('blog')
        .delete()
        .where('id = :id', { id })
        .execute()

      return !!blog.affected
    } catch (e) {
      return false
    }
  }
}
