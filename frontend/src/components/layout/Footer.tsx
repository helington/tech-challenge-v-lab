import React from 'react';
import styled from 'styled-components';
import { Container, Box, Text, Flex } from '../ui';

const FooterContainer = styled.footer`
  background-color: ${({ theme }) => theme.colors.gray[900]};
  color: ${({ theme }) => theme.colors.gray[300]};
  margin-top: auto;
`;

const FooterLink = styled.a`
  color: ${({ theme }) => theme.colors.gray[400]};
  text-decoration: none;
  transition: color 0.2s ease-in-out;
  
  &:hover {
    color: ${({ theme }) => theme.colors.white};
    text-decoration: underline;
  }
`;

export const Footer: React.FC = () => {
  return (
    <FooterContainer>
      <Container>
        <Box py={8}>
          <Flex 
            flexDirection={['column', 'row']} 
            justifyContent="space-between" 
            alignItems={['flex-start', 'center']}
            // gap={4}
          >
            <Box>
              <Text fontSize="lg" fontWeight="bold" color="white" mb={2}>
                TechBlog
              </Text>
              <Text fontSize="sm" color="gray.400">
                A modern blog platform for developers
              </Text>
            </Box>
            
            <Flex>
              <FooterLink href="#about">About</FooterLink>
              <FooterLink href="#privacy">Privacy</FooterLink>
              <FooterLink href="#terms">Terms</FooterLink>
              <FooterLink href="#contact">Contact</FooterLink>
            </Flex>
          </Flex>
          
          <Box 
            borderTop="1px solid" 
            borderColor="gray.700" 
            pt={4} 
            mt={8}
          >
            <Text fontSize="sm" color="gray.400" textAlign="center">
              © {new Date().getFullYear()} TechBlog. All rights reserved.
            </Text>
          </Box>
        </Box>
      </Container>
    </FooterContainer>
  );
};